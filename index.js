const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken')
require('dotenv').config()

const stripe = require('stripe')(process.env.STRIP_SERECT_KEY)
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
    const userCollection = database.collection("users");


    const reivewDB = client.db("bistroDb");
    const reviewsCollection = reivewDB.collection("reviews");
    const cartsCollection = reivewDB.collection("carts");
    const paymentCollection = reivewDB.collection("payment");

    //User Related API
    app.post('/users', async (req, res) => {
      const user = req.body;

      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)

      if (existingUser) {
        return res.send({ message: "User Already Exist", insertedId: null })
      }
      else {
        console.log("user API Req", user);
        const result = await userCollection.insertOne(user);
        console.log("-------------------- Result----------", result);
        return res.send(result);
      }
    })

    // JWT related API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: '2h'
      })

      res.send({ token })  // <- object akare pathachi
    });


    //Middlewares 
    const verifyToken = (req, res, next) => {
      console.log("Inside Verify Token", req.headers);

      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'Forbidden Access' })
      }

      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Forbidden Access" })
        }
        req.decoded = decoded;
        next();
      })
    }

    //use verify admin after verify token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query);

      const isAdmin = user?.role === 'admin';

      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden Access' })

      }

      next();
    }



    // get All users Data
    app.get('/allUsers', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      return res.send(result)
    })

    // Delete Users
    app.delete('/deletUsers/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    // Update user Role
    app.patch("/changeUser/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: "admin"
        }
      }

      const result = await userCollection.updateOne(query, updateDoc)
      res.send(result)
    })

    // Menu related API
    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    })

    app.get('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      res.send(result);

    })

    app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result)
    })

    app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    })


    app.get('/reviews', async (req, res) => {
      const reviews = await reviewsCollection.find().toArray();
      res.send(reviews);
    })

    app.patch('menu/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: ObjectId(id) }
      const updateDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
      }

      const result = await menuCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    //carts collection
    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      const result = await cartsCollection.insertOne(cartItem);
      res.send(result)
    })

    app.get('/carts', async (req, res) => {
      const email = req.query.email;  // <- Data nisi
      const query = { email: email }; // <- query banachi key value pair e.
      const result = await cartsCollection.find(query).toArray();  // <- query korchi data ta
      res.send(result)
    })


    //Deleting Product Data
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartsCollection.deleteOne(query);
      res.send(result);

    })


    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'unauthorized access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin"
      }
      res.send({ admin })
    })


    // Statics for Admin

    app.get('/admin-stats',verifyAdmin,verifyToken, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const menuItem = await menuCollection.estimatedDocumentCount();
      const order = await paymentCollection.estimatedDocumentCount();

      // Revenue: Way - 2 :: Not best way
      const payments = await paymentCollection.find().toArray();
     
      let revenu = payments.reduce((total, payment) => total + payment.price, 0)
      
   
      res.send({
        revenu,
        users,
        order,
        menuItem
      })
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


// Payment Related API (Intent)
app.post('/create-payment-intent', async (req, res) => {
  const { price } = req.body;
  const amount = parseInt(price * 100);


  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: "usd",
    payment_method_types: ['card']
  })

  res.send({
    clientSecret: paymentIntent.client_secret
  })

})

app.get('/payments', async (req, res) => {
  const query = { email: req.params.email }
  if (req.params.email !== req.decoded.email) {
    return res.status(403).send({ message: 'forbidden access' })
  }
  const result = await paymentCollection.find(query).toArray();


})

app.post('/payments', async (req, res) => {
  const payment = req.body;
  const paymentResult = await paymentCollection.insertOne(payment);

  // carfully delete each item from cart
  const query = {
    _id: {
      $in: payment.cartIds.map(id => new ObjectId(id))
    }
  }
  console.log('payment Info ', payment);
  const deleteResult = await cartsCollection.deleteMany(query)
  res.send({ paymentResult, deleteResult })
})





app.get('/', (req, res) => {
  res.send("Boss Server Is running");
})

app.listen(port, () => {
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