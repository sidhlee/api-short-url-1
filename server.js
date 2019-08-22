'use strict';

var express = require('express');
var mongo = require('mongodb');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var cors = require('cors');
var dns = require('dns');
var url = require('url')

const AutoIncrement = require('mongoose-sequence')(mongoose);

var app = express();

// Basic Configuration 
var port = process.env.PORT || 3000;

/** this project needs a db !! **/ 
// mongoose.connect(process.env.MONGOLAB_URI);
mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true });

const db = mongoose.connection;


db.on('error', function(err) {
  console.log(err);
})


db.once('open', function(db) {
  console.log('Database connected successfully');
  
  // you can define schema and use model outside callback because mongoose bufferes model calls internally
  const urlSchema = new mongoose.Schema({
    originalUrl: {
      type: String,
      required: true
    },
    shortUrl: {
      type: Number
    }
  });
  
  // auto-increment shortUrl field with 'mongoose-sequence' package
  urlSchema.plugin(AutoIncrement, {id: 'shortUrl_seq', inc_field: 'shortUrl'})
  
  const Url = mongoose.model('Url', urlSchema);
  
  
  
  app.use(cors());

  /** this project needs to parse POST bodies **/
  // you should mount the body-parser here
  app.use(bodyParser.urlencoded({ extended: true }));

  
  app.use('/public', express.static(process.cwd() + '/public'));

  app.get('/', function(req, res){
    res.sendFile(process.cwd() + '/views/index.html');
  });


  // post routing. 
  app.post('/api/shorturl/new', (req, res) => {
      // new URL throws for invalid URL (i.e. missing protocol)
      const inputUrl = url.parse(req.body.url); 
      let originalUrl = inputUrl.href;
      if (originalUrl.match(/.+\/$/)) { // https://google.com/ is the same as https://google.com
        originalUrl = originalUrl.slice(0, -1);
      }
      const hostname = inputUrl.hostname // returns null for invalid url
      
      // dns lookup is async!(res should be inside cb)    
      dns.lookup(hostname, function(err, address) { //dns.loopup doesn't take protocol
      
        if (err) { // err.code is set also when the host name doesn't exist (not only the lookup fails)  
          console.log("dns lookup error: " + err)
        }
        if (!address) { // If dns lookup fails
          res.json({ error: "invalid URL"})
        }
        
        else {
          
          Url.findOne({
            originalUrl: originalUrl // full href as inputted
          }, (err, doc) => {
          if (err) console.log(err);
          if (!doc) { 
            console.log("input url not found in db")
            const newDoc = new Url({ // new document instance. 
              originalUrl: originalUrl
            })
            
            newDoc.save((err, doc) => { 
              if (err) console.log(err);
              console.log("new document saved to db")
              res.json({original_url: doc.originalUrl,
                       short_url: doc.shortUrl})
              
            })
          }
          else { // Must be inside else block. Throws otherwise.
            console.log("input url already exists in db")
            res.json({original_url: doc.originalUrl,
                         short_url: doc.shortUrl})
          }
        })  
      }
          
    })         
  });
  
  // handle shortUrl params
  app.get('/api/shorturl/:short', (req, res) => {
    
    const short = req.params.short;
    Url.findOne({shortUrl: short}, (err, doc) => {
      if (err) console.log(err);
      if (doc) {
        res.redirect(doc.originalUrl);
      } else {
        res.send("short-url not found in db");
      }
    })
  })
  
  // All req not caught by set-routes
  app.use((req, res, next) => {
    res.status(400);
    res.type("text").send("Not Found");
  });
  
  
})

  
  

app.listen(port, function () {
  console.log('Node.js listening ...');
});