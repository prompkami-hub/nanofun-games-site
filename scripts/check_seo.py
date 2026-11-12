import json,urllib.request,xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
class Head(HTMLParser):
 def __init__(self):super().__init__();self.meta={};self.links=[];self.ld=[];self.in_ld=False
 def handle_starttag(self,t,a):
  a=dict(a)
  if t=='meta':self.meta[a.get('name') or a.get('property')]=a.get('content','')
  if t=='link':self.links.append(a)
  if t=='script' and a.get('type')=='application/ld+json':self.in_ld=True
 def handle_endtag(self,t):
  if t=='script':self.in_ld=False
 def handle_data(self,d):
  if self.in_ld:self.ld.append(json.loads(d))
r=Path(__file__).resolve().parents[1]/'docs';sitemap=ET.fromstring((r/'sitemap.xml').read_text());out=[]
for item in sitemap:
 url=item.find('{*}loc').text;name=url.removeprefix('https://nanofungames.com/') or 'index.html';p=Head();s=(r/name).read_text();p.feed(s)
 assert len([a for a in p.links if a.get('rel')=='canonical' and a.get('href')==url])==1,url
 assert p.meta.get('description') and p.meta.get('og:site_name')=='NanoFun Games',url
 assert p.ld and 'noindex' not in p.meta.get('robots','').lower(),url
 assert '<title>' in s and 'NanoFun Games' in s.split('<title>')[1].split('</title>')[0],url
 out.append({'url':url,'canonical':True,'schema':True,'description':True})
assert 'Allow: /' in (r/'robots.txt').read_text()
print(json.dumps({'passed':True,'pages':out},indent=2))
