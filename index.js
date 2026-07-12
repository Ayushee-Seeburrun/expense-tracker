import express from "express";
import bodyParser from "body-parser";


const server = express();
server.use(bodyParser.json());

server.get('/get-user', (req, res) => {

    //query from db

    //convert result from db to json

    //send back to client
    res.status(200).json({ 
        message: "User data retrieved successfully" 
    });
})

server.post('/get-user', (req, res) => {
    
    const { address, first_name, last_name, dob } = req.body;


    res.status(200).send("hello world");
})

server.listen('3000', () => {
    console.log("Server is running on port 3000");
});