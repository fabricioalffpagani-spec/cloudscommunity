(async () => {
  try {
    const url = 'http://127.0.0.1:3000/api/auth/signup';
    const body = {
      email: 'test4@example.com',
      name: 'Teste',
      username: 'testuser4',
      birthDate: '2000-01-01',
      password: 'Test1234',
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    console.log('status', res.status);
    console.log('statusText', res.statusText);
    const headers = {};
    res.headers.forEach((v, k) => (headers[k] = v));
    console.log('headers', headers);
    const text = await res.text();
    try {
      console.log('body', JSON.parse(text));
    } catch (e) {
      console.log('body (raw)', text);
    }
  } catch (err) {
    console.error('error', err);
    process.exit(1);
  }
})();
