/**
 * Load Socket.io synchronously so teacher.js / student.js can call io().
 */
document.write(
  '<script src="' +
  (window.socketOrigin || window.location.origin).replace(/\/$/, '') +
  '/socket.io/socket.io.js"><\/script>'
);
