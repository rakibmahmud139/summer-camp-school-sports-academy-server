const express = require('express');
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;



// Middleware
app.use(cors());
app.use(express.json());




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




        //student Collection
        app.get('/students', async (req, res) => {
            const result = await studentCollection.find().toArray();
            res.send(result);
        })


        app.post('/students', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await studentCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: "user already exits" })
            }
            const result = await studentCollection.insertOne(user);
            res.send(result);
        })


        //Make Admin
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

        //Make Instructor
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




        //instructors API
        app.get('/instructors', async (req, res) => {
            const result = await instructorCollection.find().toArray();
            res.send(result);
        })


        //Carts API
        app.get('/carts', async (req, res) => {
            const result = await cartCollection.find().toArray();
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