const express = require('express');
const cors = require('cors');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;



// Middleware
app.use(cors());
app.use(express.json());


const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized domain' })
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized domain' })
        }
        req.decoded = decoded;
        next()
    })
}




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.z4vmthe.mongodb.net/?retryWrites=true&w=majority`;

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


        const classCollection = client.db("academyDB").collection("classes");
        const instructorCollection = client.db("academyDB").collection("instructors");
        const cartCollection = client.db("academyDB").collection("carts");
        const studentCollection = client.db("academyDB").collection("students");
        const paymentCollection = client.db("academyDB").collection("payments");


        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' });
            res.send({ token });
        })


        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await studentCollection.findOne(query);
            if (user.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' })
            }
            next()
        }


        //Student related API
        app.get('/students', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await studentCollection.find().toArray();
            res.send(result);
        })

        app.get("/student/admin/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email };
            const user = await studentCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })


        app.post('/students', async (req, res) => {
            const student = req.body;
            const query = { email: student.email }
            const existingStudent = await studentCollection.findOne(query)
            if (existingStudent) {
                return res.send({ message: "Student already exits" })
            }
            const result = await studentCollection.insertOne(student);
            res.send(result);
        })

        //make admin
        app.patch('/students/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await studentCollection.updateOne(filter, updateDoc);
            res.send(result);
        })


        //make instructor

        app.patch('/students/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instructor'
                }
            }
            const result = await studentCollection.updateOne(filter, updateDoc);
            res.send(result);
        })



        //classes API
        app.get('/classes', async (req, res) => {
            const result = await classCollection.find().toArray();
            res.send(result)
        })

        app.post('/classes', verifyJWT, async (req, res) => {
            const data = req.body;
            const result = await classCollection.insertOne(data);
            res.send(result)
        })

        app.get('/classes/instructor', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.send([])
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const query = { email: email };
            const result = await classCollection.find(query).toArray();
            res.send(result);
        })

        //instructor
        app.get("/student/instructor/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }

            const query = { email: email };
            const user = await studentCollection.findOne(query);
            const result = { admin: user?.role === 'instructor' }
            res.send(result);
        })



        //instructors API
        app.get('/instructors', async (req, res) => {
            const result = await instructorCollection.find().toArray();
            res.send(result);
        })



        //Carts API
        app.get('/carts', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.send([])
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        })


        app.post('/carts', async (req, res) => {
            const body = req.body;
            const result = await cartCollection.insertOne(body);
            res.send(result);
        })


        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })



        //payment gateway APIs
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ["card"]
            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })


        app.post('/payments', async (req, res) => {
            const payment = req.body;

            const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } };
            const deleteResult = await cartCollection.deleteMany(query);

            const insertResult = await paymentCollection.insertOne(payment)
            res.send({ insertResult, deleteResult });
        })


        app.get('/admin-stats', verifyJWT, verifyAdmin, async (req, res) => {
            const students = await studentCollection.estimatedDocumentCount();
            const totalClasses = await classCollection.estimatedDocumentCount();
            const paidClass = await paymentCollection.estimatedDocumentCount();
            const payments = await paymentCollection.find().toArray();
            const revenue = payments.reduce((sum, payment) => sum + payment.price, 0)
            res.send({
                students,
                totalClasses,
                paidClass,
                revenue
            });
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






app.get('/', (req, res) => {
    res.send('SPORTS ACADEMY SERVER IS RUNNING')
})


app.listen(port, () => {
    console.log(`SPORTS ACADEMY SERVER IS RUNNING ON PORT: ${port}`);
})