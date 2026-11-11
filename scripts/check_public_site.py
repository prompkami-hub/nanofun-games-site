#!/usr/bin/env python3
"""Read-only public reachability smoke check; never calls wallet or ad endpoints."""
import argparse, concurrent.futures, json, ssl
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.refs=[]; self.canonicals=[]; self.noindex=False
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag in ('a','link') and a.get('href'): self.refs.append(a['href'])
        if tag in ('script','img') and a.get('src'): self.refs.append(a['src'])
        if tag=='link' and a.get('rel')=='canonical': self.canonicals.append(a.get('href'))
        if tag=='meta' and a.get('name','').lower() in ('robots','googlebot'):
            self.noindex |= 'noindex' in a.get('content','').lower()

def run(base):
    origin=base.rstrip('/')+'/'
    paths=['','ads.txt','robots.txt','sitemap.xml','help.html','privacy.html','2048.html','snake.html','volleyball.html','drift-coast.html','games/drift-coast/','games/2048/','games/snake/','games/pikachu-volleyball/']
    results=[]
    def get(url, agent):
        try:
            with urlopen(Request(url, headers={'User-Agent':agent}),timeout=20) as response:
                body=response.read(2_000_000)
                return {'url':url,'agent':agent,'status':response.status,'final_url':response.url,'tls_verified':urlparse(url).scheme=='https','content_type':response.headers.get('Content-Type'), 'x_robots_tag':response.headers.get('X-Robots-Tag',''),'bytes_read':len(body)},body
        except Exception as error:
            return {'url':url,'agent':agent,'error':str(error)},b''
    for agent in ['Mediapartners-Google','Google-Display-Ads-Bot']:
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            fetched=list(pool.map(lambda p:get(urljoin(origin,p),agent),paths))
        for row,body in fetched:
            results.append(row)
            if row.get('status')!=200: continue
            path=urlparse(row['url']).path
            if path.endswith('ads.txt'): row['publisher_line_correct']=body.decode().strip()=='google.com, pub-5541781771201133, DIRECT, f08c47fec0942fa0'
            if path.endswith('sitemap.xml'): row['sitemap_entries']=len(ET.fromstring(body))
            if 'text/html' in row.get('content_type',''):
                parser=Links();parser.feed(body.decode(errors='replace'));row['noindex']=parser.noindex;row['canonical']=parser.canonicals
                if path=='/':
                    row['public_guide_links']=all(p+'.html' in parser.refs for p in ['2048','snake','volleyball'])
                    row['ads_sdk_loaded']=any('adsbygoogle' in p or 'rewarded-ads' in p for p in parser.refs)
    good=all(r.get('status')==200 and not r.get('noindex') and not r.get('ads_sdk_loaded') and r.get('publisher_line_correct',True) and r.get('public_guide_links',True) for r in results)
    return {'checked_at':datetime.now(timezone.utc).isoformat(),'base_url':origin,'passed':good,'limitations':['User-Agent checks do not prove a request originated from Google or predict approval.','No wallet, customer record, payment or ad-view request is performed.'],'checks':results}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--base',default='https://nanofungames.com/');p.add_argument('--output');a=p.parse_args();report=run(a.base)
    encoded=json.dumps(report,ensure_ascii=False,indent=2)+'\n'
    if a.output:
        with open(a.output,'w') as f:f.write(encoded)
    print(json.dumps({'passed':report['passed'],'checks':len(report['checks']),'failed':[r for r in report['checks']if r.get('status')!=200 or r.get('noindex') or r.get('ads_sdk_loaded') or not r.get('public_guide_links',True)]},ensure_ascii=False))
    raise SystemExit(0 if report['passed']else 1)
