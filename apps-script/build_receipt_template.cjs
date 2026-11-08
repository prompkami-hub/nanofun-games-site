const fs=require('node:fs');
const path=require('node:path');
const root=__dirname,source=path.join(root,'Code.gs'),template=fs.readFileSync(path.join(root,'templates/purchase_receipt.html'),'utf8');
let code=fs.readFileSync(source,'utf8');
const block='// BEGIN GENERATED RECEIPT TEMPLATE\nconst NF_RECEIPT_HTML='+JSON.stringify(template)+';\n// END GENERATED RECEIPT TEMPLATE';
code=code.includes('// BEGIN GENERATED RECEIPT TEMPLATE')?code.replace(/\/\/ BEGIN GENERATED RECEIPT TEMPLATE[\s\S]*?\/\/ END GENERATED RECEIPT TEMPLATE/,block):code+'\n'+block+'\n';
fs.writeFileSync(source,code);
