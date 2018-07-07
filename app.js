var express = require('express');
var path = require('path');
var compression = require('compression');
var favicon = require('serve-favicon');
var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var i18n = require('i18n');
var passport = require('passport');

var logger = require('./lib/services/logger');
var ssl = require('./lib/services/ssl');

var routes = require('./routes/index');
var oauth = require('./routes/oauth');
var user = require('./routes/user');

var app = express();

// ssl
app.use(ssl.enforceSSL);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(compression());
app.use(favicon(path.join(__dirname, 'public', 'images/nanoRSS-favicon.png')));
app.use(morgan('tiny', { stream: logger.stream }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/bootstrap', express.static(path.join(__dirname , '/node_modules/bootstrap')));
app.use('/popper', express.static(path.join(__dirname , '/node_modules/popper')));
app.use('/jquery', express.static(path.join(__dirname , '/node_modules/jquery')));

app.use('/', routes);
app.use('/oauth', oauth);
app.use('/user', user);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error(i18n.__('Not Found'));
  err.status = 404;
  next(err);
});

// i18n
require('./lib/services/i18nconfiguration');
app.locals.__= i18n.__;

// authentication
app.use(passport.initialize());

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    logger.logException(err);
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  logger.logException(err);
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
