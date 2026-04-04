(async function(){
  try{
    const jwt = require('../backend/node_modules/jsonwebtoken');
    const token = jwt.sign({ userId: 'local-admin', email: 'admin@local', role: 'admin' }, 'your-super-secret-jwt-key-change-this-in-production', { expiresIn: '7d' });
    console.log('TOKEN:', token.slice(0,60) + '...');

    const base = 'http://localhost:3000';

    const usersRes = await fetch(`${base}/api/admin/users`, { headers: { Authorization: 'Bearer ' + token } });
    console.log('GET /api/admin/users status', usersRes.status);
    const usersJson = await usersRes.json().catch(() => null);
    console.log('GET body (truncated):', JSON.stringify(usersJson).slice(0, 1000));
    const userId = usersJson?.data?.users?.[0]?.id || null;
    console.log('Target user id:', userId);

    if (userId) {
      const postRes = await fetch(`${base}/api/admin/users/${userId}/message`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Automated test message from admin' }),
      });
      console.log('POST status', postRes.status);
      const postJson = await postRes.json().catch(() => null);
      console.log('POST body:', JSON.stringify(postJson));
    } else {
      console.log('No userId found to POST to');
    }
  }catch(e){
    console.error('Error', e);
    process.exitCode = 1;
  }
})();
