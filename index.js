const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9sm3chy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("bistroDb");
    const menuCollection = database.collection("menu");


    const reivewDB = client.db("bistroDb");
    const reviewsCollection = reivewDB.collection("reviews");
    const cartsCollection = reivewDB.collection("carts");

    app.get('/menu',async (req,res)=>{
      const result = await menuCollection.find().toArray();
      res.send(result);
    })

    app.get('/reviews',async (req,res)=>{
      const reviews = await reviewsCollection.find().toArray();
      res.send(reviews);
    })


    //carts collection
    app.post('/carts',async (req,res)=>{
      const cartItem = req.body;
      const result = await cartsCollection.insertOne(cartItem);

    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);






app.get('/',(req,res)=>{
  res.send("Boss Server Is running");  
})

app.listen(port,()=>{
  console.log(`Bistro boss Server is Running on Port ${port}`)
})


/*
  *-----------------------------------
  *       Naming Convention
  *-----------------------------------
  * app.get('/user')   <- get only a user
  * app.get('/users/:id') <- get specific user
  * app.post('/users')  <- creating a user
  * app.put('/users/:id') <- update a specific users
  * app.patch('/users/:id')  <- modify only a specific users
  * app.delete('/users/:id') <- delete only a specific users
*/