//NOTE:-
//Internally async and await implements promise chaining only behind the scene, but
//the code looks more readable so we can use both "async await" OR ".then .catch"
//based on our convinience and comfort

const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/user');

exports.signup = async (req, res, next) => {
    const errors = validationResult(req);
    // try {
    if(!errors.isEmpty()){
        const error = new Error('Validation failed');
        error.statusCode = 422;
        error.data = errors.array();
        throw error;
    }

    const email = req.body.email;
    const password = req.body.password;
    const name = req.body.name;

    try {
        const hashedPassword = await bcrypt.hash(password, 12);

        const user = new User({
            email: email,
            password: hashedPassword,
            name: name
        });

        const result = await user.save();
        
        res.status(201).json({
            message: "User created successfully",
            userId: result._id
        });
    } catch(err) {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
}

exports.login = async (req, res, next) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        const error = new Error('Validation failed');
        error.statusCode = 422;
        error.data = errors.array();
        throw error;
    }

    const email = req.body.email;
    const password = req.body.password;

    try {
        const user = await User.findOne({ email: email })

        if(!user){
            const error = new Error("No user found with given email!");
            error.statusCode = 401; //'401'- Not authenticated
            throw error;
        }

        const isEqual = await bcrypt.compare(password, user.password);
       
        if(!isEqual){
            const error = new Error("Credentials entered by you is not valid!");
            error.statusCode = 401; //'401'- Not authenticated
            throw error;
        }

        const token = jwt.sign(
            {
                email: user.email,
                userId: user._id.toString()
            },
            "ThisIsMySecretForJWT",
            {
                expiresIn: '1h' //it will destroy token in 1 hour
            }
        );

        res.status(200).json(
            {
                token: token,
                userId: user._id.toString()
            }
        );
    } catch(err) {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
}

exports.getUserStatus = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId)
        
        if(!user){
            const error = new Error('No user found!');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            message: "Status fetched successfully!",
            status: user.status
        });
    } catch(err) {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
}

exports.updateUserStatus = async (req, res, next) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        const error = new Error('Validation failed');
        error.statusCode = 422;
        error.data = errors.array();
        throw error;
    }

    const status = req.body.status;

    try {
        const user = await User.findById(req.userId)
        
        if(!user){
            const error = new Error('No user found!');
            error.statusCode = 404;
            throw error;
        }
        
        user.status = status;
        await user.save();

        res.status(200).json({
            message: "Status updated successfully!",
            status: status
        });
    } catch(err) {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
}