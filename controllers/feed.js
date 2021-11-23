//NOTE:-
//Internally async and await implements promise chaining only behind the scene, but
//the code looks more readable so we can use both "async await" OR ".then .catch"
//based on our convinience and comfort

const fs = require('fs');
const path = require('path');

const { validationResult } = require('express-validator');

const io = require('../socket');

const Post = require('../models/post');
const User = require('../models/user');

exports.getPosts = async (req,res,next) => {
    const currentPage = req.query.page || 1;
    const perPage = 2;

    try {
        const totalItems = await Post.find()
            .countDocuments();

        const posts = await Post
                    .find()
                    .populate('creator')
                    .sort({ createdAt: -1 })
                    .skip((currentPage -1) * perPage)
                    .limit(perPage);

        res.status(200).json({
            message: "posts Fetched successfully",
            posts: posts,
            totalItems: totalItems
        });
    } catch(err) {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
    // res.status(200).json({
    //     posts: [
    //         {
    //             title: "My First Post!",
    //             content: "This is the content of my first post.",
    //             creator: {
    //                 name: "DummyUser"
    //             },
    //             createdAt: new Date()
    //         }
    //     ]
    // });
}

exports.createPost = async (req,res,next) => {
    const errors = validationResult(req);

    if(!errors.isEmpty()){
        const error = new Error("Validation failed, Please check your inputs");
        error.statusCode = 422;

        throw error;
        // return res.status(422).json({
        //     message: "Validation failed, Please check your inputs",
        //     error: errors.array()
        // })
    }

    if(!req.file){
        const error = new Error("No image is provided.");
        error.statusCode = 422;

        throw error;
    }

    const imageUrl = req.file.path.replace("\\" ,"/");
    const title = req.body.title;
    const content = req.body.content;

    const post = new Post({
        title: title,
        content: content,
        creator: req.userId,
        // imageUrl: 'images/Dummy_Image.png'
        imageUrl: imageUrl
    });

    try {
        await post.save();

        const user = await User.findById(req.userId); //fetching user to update it's 'posts' property

        user.posts.push(post);
        const result = await user.save(); //updated user's 'posts' property

        //code to use socket.io
        io.getIO().emit('posts', { //'emit' will send action to all the users having 'socket.io'
            action: 'create',     // connection established, 'broadcast' will do same except it
            post: {               //will not send action to originating user
                ...post._doc,
                creator: {
                    _id: req.userId,
                    name: user.name
                }
            }
        });
        
        //first argument is the name of action server want to send to users
        //second argument here is the data that server wants to pass
        //code to use socket.io

        res.status(201).json({ //"200" is default status code, that would be valid but "201" is
            //more appropriate
            message: "Post created successfully!",
            post: post,
            creator: { 
                _id: result._id, 
                name: result.name 
            }
        });
    } catch (err) {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
}

exports.getPost = async (req, res, next) => {
    const postId = req.params.postId;
    try {
        const post = await Post.findById(postId);

        if(!post){
            const err = new Error("No such post available");
            err.statusCode = 404;
            throw err;
        }

        res.json({
            message: "Post Fetched!",
            post: post
        })
    } catch (err) {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
}

exports.updatePost = async (req, res, next) => {
    const postId = req.params.postId;
    const errors = validationResult(req);

    if(!errors.isEmpty()){
        const error = new Error("Validation failed, Please check your inputs");
        error.statusCode = 422;

        throw error;
    }

    const title = req.body.title;
    const content = req.body.content;
    let imageUrl = req.body.image;

    if(req.file){
        imageUrl = req.file.path.replace("\\" ,"/");
    }

    if(!imageUrl){
        const error = new Error("No image is provided.");
        error.statusCode = 422;

        throw error;
    }

    try {
        const post = await Post.findById(postId).populate('creator');
        
        if(!post){
            const err = new Error("No such post available");
            err.statusCode = 404;
            throw err;
        }

        //checking if user is authorized for operation
        if(post.creator._id.toString() !== req.userId){
            const error = new Error("You are not authorized!");
            error.statusCode = 403;
            throw error;
        }

        if(imageUrl !== post.imageUrl){
            clearImage(post.imageUrl);
        }

        post.title = title;
        post.content = content;
        post.imageUrl = imageUrl;
        const result = await post.save();

        //code to use socket.io
        io.getIO().emit('posts', {
            action: 'update',
            post: result
        });
        //code to use socket.io

        res.status(200).json({
            message: "Post updated successfully!",
            post: result
        })
    } catch(err) {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
}

exports.deletePost = async (req, res, next) => {
    const postId = req.params.postId;

    try {
        const post = await Post.findById(postId);
        
        if(!post){
            const err = new Error("No such post available");
            err.statusCode = 404;
            throw err;
        }

        //checking if user is authorized for operation
        if(post.creator.toString() !== req.userId){
            const error = new Error("You are not authorized!");
            error.statusCode = 403;
            throw error;
        }

        clearImage(post.imageUrl);
        await Post.findByIdAndRemove(postId);
        
        const user = await User.findById(req.userId); //retrieving creator of post
        
        user.posts.pull(postId); 
        await user.save(); //removing post from "user" collection as well
 
        //code to use socket.io
        io.getIO().emit('posts', {
            action: 'delete',
            post: postId
        });
        //code to use socket.io

        res.status(200).json({
            message: "Post deleted successfully!"
        })
    } catch(err) {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
}