const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { graphqlHTTP } = require('express-graphql');

const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/auth');
const { clearImage } = require('./utils/file');

const fileStorage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'images');
    },
    filename: function(req, file, cb) {
        cb(null, uuidv4() + '-' + file.originalname);
    }
});

const fileFilter = (req, file, cb) => {
    if(
        file.mimetype === 'image/png' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/jpeg'
    ){
        cb(null, true);
    }
    else{
        cb(null, false);
    }
}

const app = express();

// app.use(bodyParser.urlencoded()); //appropriate for content-type = 'x-www-from-urlencoded' <form>
app.use(bodyParser.json()); //appropriate for content-type= "application/json"
app.use(
    multer({ storage: fileStorage, fileFilter: fileFilter}).single('image')
);

app.use('/images', express.static(path.join(__dirname, 'images'))); //define static paths

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    //'*' indicates it will allow all the domains, we can specify list in real-world
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    // Second argument specifies the HTTP methods allowed
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    // Second argument specifies the headers allowed in request, added "authorization"
    //to allow consumer to sent authorization information

    if(req.method === 'OPTIONS'){
        return res.sendStatus(200);
    }
    next();
})

app.use(auth); //will authenticate all the services going to '/graphql'

//to save image locally
app.put('/post-image', (req, res, next) => {
    if(!req.isAuth){
        throw new Error("User is not authenticated.");
    }

    if(!req.file){
        return res.status(200).json({ message: 'No file provided!'});
    }

    if(req.body.oldPath){
        clearImage(req.body.oldPath);
    }

    res.status(201).json({
        message: 'File uploaded',
        filePath: req.file.path.replace("\\" ,"/")
    });
});

app.use( //to use "graphiql" we didn't use 'POST' here
    '/graphql', //common convention, can be anything
    graphqlHTTP({ //automatically decline the requests whose method is not "GET" or "POST"
        schema: graphqlSchema,
        rootValue: graphqlResolver,
        graphiql: true,
        // formatError(err){ //"formatError" is deprecated replace it with "customFormatErrorFn"
        customFormatErrorFn(err){ 
            if(!err.originalError){
                return err;
            }
            const data = err.originalError.data;
            const message = err.message || 'An error occured.';
            const code = err.originalError.code || 500;

            return {
                message: message,
                status: code,
                data: data
            };
        }
    })
);

app.use((error, req, res, next) => {
    const status = error.statusCode || 500;
    const message = error.message;
    const data = error.data

    res.status(status).json({
        message: message,
        data: data
    });
});

mongoose.connect(
    'mongodb://MongoDB_User:MongoDBUser%40210791@node-complete-shard-00-00.0vl9o.mongodb.net:27017,node-complete-shard-00-01.0vl9o.mongodb.net:27017,node-complete-shard-00-02.0vl9o.mongodb.net:27017/messages?ssl=true&replicaSet=atlas-13wbgl-shard-0&authSource=admin&retryWrites=true&w=majority'
)
.then(result => {
    console.log('Connected!');
    app.listen(8080);
})
.catch(err => console.log(err));
