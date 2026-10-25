const database = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open('closetrace-demo-files', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('Your browser could not open document storage.'));
  });
export async function storeDemoFile(id, file) {
  const db = await database();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').put(file, id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(new Error('The document could not be stored in this browser.'));
    });
  } finally {
    db.close();
  }
}
export async function loadDemoFile(id) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction('files').objectStore('files').get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = reject;
    });
  } finally {
    db.close();
  }
}
