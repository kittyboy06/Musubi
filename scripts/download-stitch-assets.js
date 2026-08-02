const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), '.stitch', 'designs');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const screens = [
  { id: 'f592829c2253470194c7399d47dfc700', title: 'Dashboard', url: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2Y4Y2U5NzcyMjBkZDQ2YmE4ZTM0OTc1OTFhMWY4MjVhEgsSBxC57J2apxYYAZIBJAoKcHJvamVjdF9pZBIWQhQxODM3MzQ2MzM2MzQ4MjUxOTkyNg&filename=&opi=96797242' },
  { id: 'fc8e33ecd8184dad8a66565265812fc0', title: 'JournalVault', url: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzViMWRhMzk5MzQwMjRiN2U4YjQwNGY0MmVjMzAxMWM2EgsSBxC57J2apxYYAZIBJAoKcHJvamVjdF9pZBIWQhQxODM3MzQ2MzM2MzQ4MjUxOTkyNg&filename=&opi=96797242' },
  { id: '7d44e23c46d24fe785332879561f75e3', title: 'VaultChat', url: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzkyZTJlMTYwMTEwODQ0Yzg5YTk4ZDdkNjQ3ODQzN2NlEgsSBxC57J2apxYYAZIBJAoKcHJvamVjdF9pZBIWQhQxODM3MzQ2MzM2MzQ4MjUxOTkyNg&filename=&opi=96797242' },
  { id: '46c9d9d6019441678b091744c25b826f', title: 'KnowledgeGraph', url: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2E0MWVmMDZjMWFiNTQ4NDQ4ZjcxMGJlZDgwYzg3MGY3EgsSBxC57J2apxYYAZIBJAoKcHJvamVjdF9pZBIWQhQxODM3MzQ2MzM2MzQ4MjUxOTkyNg&filename=&opi=96797242' }
];

async function download() {
  for (const s of screens) {
    try {
      const res = await fetch(s.url);
      const html = await res.text();
      fs.writeFileSync(path.join(dir, `${s.title}.html`), html, 'utf8');
      console.log('Saved Stitch HTML design:', s.title, html.length, 'bytes');
    } catch (e) {
      console.error('Error downloading:', s.title, e);
    }
  }

  const meta = {
    projectId: '18373463363482519926',
    title: 'MUSUBI - Obsidian Vault & AI Chatbot',
    deviceType: 'MOBILE',
    lastSyncTime: new Date().toISOString(),
    screens: screens.reduce((acc, s) => {
      acc[s.id] = { label: s.title, id: s.id };
      return acc;
    }, {})
  };

  fs.writeFileSync(path.join(process.cwd(), '.stitch', 'metadata.json'), JSON.stringify(meta, null, 2), 'utf8');
  console.log('Saved .stitch/metadata.json cleanly.');
}

download();
