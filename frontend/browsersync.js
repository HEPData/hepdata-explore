const browserSync = require('browser-sync');
browserSync({server: '.'});

// Set up a simple reload endpoint
const reloadPort = 10000;
const app = require('express')();
app.get('/reload', function (req, res) {
  browserSync.reload();
  res.send('Reloaded');
});
app.listen(reloadPort, function () {
  console.log('Listening for reload requests on port %d', reloadPort);
});