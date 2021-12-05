const express = require("express");
const app = express();
const cors = require("cors");

const admin = require("firebase-admin");

const port = process.env.PORT || 5000;
require("dotenv").config();
const { MongoClient } = require("mongodb");
const { query } = require("express");
const ObjectId = require('mongodb').ObjectId;
const fileUpload = require('express-fileupload');
const stripe = require('stripe')(process.env.STRIPE_SECRET)

const serviceAccount = require(`./fir-practice-284d6-firebase-adminsdk-nrb94-2da769ba41.json`);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(cors()); // 3000 port the data pathanor jonno
app.use(express.json());
app.use(fileUpload())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2qgnz.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// console.log(uri);

async function verifyToken(req, res, next) {
  if (req.headers.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("doctors_portal");
    const appointmentsCollection = database.collection("appointments");
    const usersCollection = database.collection("users");
    const doctorsCollection = database.collection("doctors");

    console.log("database connected");

    app.get("/appointments",verifyToken, async (req, res) => {
      const email = req.query.email;
      const date = new Date(req.query.date).toLocaleDateString();
      console.log(date,email);
      const query = { email: email, date: date };
      console.log(query);
      const cursor = appointmentsCollection.find(query);
      const appointments = await cursor.toArray();
      console.log(appointments);
      res.json(appointments);
    });

    app.get("/appointments/:id",async(req,res)=>{
      const id = req.params.id;
      const query = {_id: ObjectId(id)};
      const result = await appointmentsCollection.findOne(query);
      res.json(result)
    })
    app.post("/appointments", async (req, res) => {
      const appointment = req.body;
      const result = await appointmentsCollection.insertOne(appointment);
      res.json(result);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;

      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.json(result);
    });
    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const option = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(filter, updateDoc, option);
      res.json(result);
    });
    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      // console.log(user);
      const requester = req.decodedEmail;

      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = {
            $set: { role: "admin" }
          };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      }
      else{
        res.status(403).json({message:'you can not make admin'});
      }
    });

    app.post('/create-payment-intent',async(req,res)=>{
      const paymentInfo = req.body;
      const amount = paymentInfo.price*100;
      const paymentIntent = await stripe.paymentIntents.create({
        currency : 'usd',
        payment_method_types: ['card'],
        amount:amount
      })
      res.json({clientSecret:paymentIntent.client_secret})
    })

    app.put('/appointments/:id', async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updateDoc = {
          $set: {
              payment: payment
          }
      };
      const result = await appointmentsCollection.updateOne(filter, updateDoc);
      res.json(result);
  })

      // doctors api
      app.get('/doctors', async (req, res) => {
        const cursor = doctorsCollection.find({});
        const doctors = await cursor.toArray();
        res.json(doctors);
    });

  app.post('/doctors',async(req,res)=>{
    // console.log(req.body);
    const name = req.body.name;
    const email = req.body.email;
    const pic = req.files.image;
    const picData = pic.data;
    const encodedPic = picData.toString('base64')
    const imageBuffer = Buffer.from(encodedPic,'base64')
    const doctor = {
      name:name,
      email:email,
      image:imageBuffer
    }
    const result =await doctorsCollection.insertOne(doctor)
    res.json(result)
    // console.log(req.files);
  })
  } finally {
    //   await client.close();
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Hello doctors Portal");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
