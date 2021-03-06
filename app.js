var express = require('express');
var path = require('path');
var compression = require('compression');
var favicon = require('serve-favicon');
var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var passport = require('passport');

var logger = require('./lib/services/logger');
var ssl = require('./lib/services/ssl');
var errorrenderer = require('./lib/services/errorrenderer');

var routes = require('./routes/index');
var oauth = require('./routes/oauth');
var user = require('./routes/user');

var app = express();

// ssl
app.use(ssl.enforceSSL);

// view engine setup
app.set('views', path.join(__dirname, 'views'));

app.use(compression());
app.use(favicon(path.join(__dirname, 'dist', 'nanorss', 'favicon.ico')));
app.use(morgan('tiny', { stream: logger.stream }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'dist', 'nanorss')));

app.use('/', routes);
app.use('/oauth', oauth);
app.use('/user', user);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// authentication
app.use(passport.initialize());

// error handler

app.use(errorrenderer);


module.exports = app;
