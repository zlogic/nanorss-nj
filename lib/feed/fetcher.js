var persistence = require('../services/persistence');
var needle = require('needle');
var xml2js = require('xml2js');
var util = require('util');
var logger = require('../services/logger').logger;
var logException = require('../services/logger').logException;

var parseXmlString = util.promisify(xml2js.parseString);

var configUrls = async function(){
  var feeds = await persistence.getFeeds();
  return feeds.map(function(feed) {
    return feed.url;
  });
};

var parseFeed = function(feedXml, feedUrl){
  var getElementText = function(item){
    if(item === undefined || item[0] === undefined)
      return null;
    if(item[0]._ !== undefined)
      return item[0]._;
    if(item[0].$ !== undefined)
      return new xml2js.Builder().buildObject(item);
    return item[0];
  };
  var parseRss = function(rss){
    if(rss.channel[0].item === undefined)
      return [];
    return rss.channel[0].item.map(function(item, i){
      var guid = getElementText(item.guid);
      guid = guid !== null ? guid : getElementText(item.link);
      guid = feedUrl + '@@' + (guid !== null ? guid : i);
      var date = getElementText(item.pubDate);
      date = date !== null ? new Date(date) : new Date();
      var contents = getElementText(item['content:encoded'])
      contents = contents !== null ? contents: getElementText(item.description);
      return {
        guid: guid,
        title: getElementText(item.title),
        url: getElementText(item.link),
        date: date,
        contents: contents
      };
    });
  };
  var parseAtom = function(atom){
    if(atom.entry === undefined)
      return [];
    return atom.entry.map(function(item, i){
      var url = item.link.find(function(link){
        return link.$ !== undefined && link.$.href !== undefined && (link.$.type === 'text/html' || link.$.type === undefined) && (link.$.rel === 'alternate' || link.$.rel === undefined);
      });
      url = url !== undefined ? url.$.href : undefined;
      url = url !== undefined ? url : null;
      var guid = getElementText(item.guid);
      guid = guid !== null ? guid : url;
      guid = feedUrl + '@@' + (guid !== null ? guid : i);
      var contents = getElementText(item.content);
      contents = contents !== null ? contents : getElementText(item.summary);
      var date = getElementText(item.updated);
      date = date !== null ? new Date(date) : new Date();
      return {
        guid: guid,
        title: getElementText(item.title),
        url: url,
        date: date,
        contents: contents
      };
    });
  };
  var parseRDF = function(rdf){
    if(rdf.item === undefined)
      return [];
    return rdf.item.map(function(item, i){
      var guid = getElementText(item.link);
      guid = feedUrl + '@@' + (guid !== null ? guid : i);
      return {
        guid: guid,
        title: getElementText(item.title),
        url: getElementText(item.link),
        date: new Date(getElementText(item['dc:date'])),
        contents: getElementText(item.description)
      };
    });
  };
  if(feedXml.rss !== undefined)
    return parseRss(feedXml.rss);
  if(feedXml.feed !== undefined && feedXml.feed.$ !== undefined && feedXml.feed.$.xmlns === 'http://www.w3.org/2005/Atom')
    return parseAtom(feedXml.feed);
  if(feedXml['rdf:RDF'] !== undefined && feedXml['rdf:RDF'].$ !== undefined && feedXml['rdf:RDF'].$['xmlns:rdf'] === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#')
    return parseRDF(feedXml['rdf:RDF']); //TheOatmeal hack. RDF is terrible!
  logger.error('Cannot parse feed:\n%s', JSON.stringify(feedXml));
  throw new Error('Cannot parse feed');
};

var fetchFeed = async function(url){
  logger.verbose("Fetching feed %s", url);
  try {
    var response = await needle('get', url, {parse_response: false});
    var parseResult = await parseXmlString(response.body);
    var feedItems = parseFeed(parseResult, url);
    await persistence.saveFeed(url, feedItems);
  } catch(err) {
    logger.error("Error processing feed %s", url);
    throw err;
  }
};

var update = async function(){
  try {
    var urls = await configUrls();
    await Promise.all(urls.map(async function(url){
      try{
        await fetchFeed(url);
      } catch(err) {
        logException(err);
      }
    }));
  } catch(err) {
    logException(err);
  }
};

var cleanup = async function(){
  var expireDays = JSON.parse(process.env.ITEM_EXPIRE_DAYS || 30);
  var expireDate = new Date(new Date().getTime() - expireDays * 24 * 60 * 60 * 1000);
  try {
    await persistence.cleanupOrphanedFeeds()
    await persistence.cleanupExpiredFeedItems();
  } catch(err) {
    logException(err);
  }
};

module.exports.update = update;
module.exports.cleanup = cleanup;
