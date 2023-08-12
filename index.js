const express = require('express');

const cors = require('cors');

const app = express();

app.use(cors());

app.use(express.json());

const port = 25566

const mongo = require('mongodb').MongoClient;

const url = 'mongodb+srv://paulo:74zMDoVU7IzB4Byv@cluster0.6mwguxi.mongodb.net/';

const client = new mongo(url, { useNewUrlParser: true, useUnifiedTopology: true });

client.connect().then(() => {
    console.log('Connected to MongoDB')
});

app.get('/webhooks/betgames/query', async (req, res) => {

    const { access_token } = req.body;
    console.log(access_token)
    if (!access_token) return res.status(400).json({ message: 'Missing access_token' });

    const user = await client.db('global').collection('users').findOne({ access_token })

    if (user) {
        res.json(user);
    } else {
        res.status(404).json({ message: 'User not found' });
    }
});

app.post('/webhooks/betgames/apost', async (req, res) => {
    let { access_token, amount } = req.body;

    if (!access_token) return res.status(400).json({ message: 'Missing access_token' }).end();

    if (!amount) return res.status(400).json({ message: 'Missing amount' }).end();

    if (typeof amount !== "number") return res.status(400).json({ message: 'Amount must be a number' }).end()

    if (amount < 0) return res.status(400).json({ message: 'Amount must be positive' }).end()

    const user = await client.db('global').collection('users').findOne({ access_token })

    if (user) {
        if (user.balance < amount) return res.status(400).json({ message: 'Insufficient balance' }).end();

        user.balance -= amount;

        const tx = {
            id: Math.floor(Math.random() * 1000000),
            amount: amount,
            type: 'bet',
            winned: null,
            received: 0,
            date: new Date()
        };

        res.json({
            "operator_tx_id": tx.id,
            "new_balance": user.balance,
            "user_id": user.id,
            "currency": "BRL",
        });

        await client.db('global').collection('users').updateOne({ access_token }, { $inc: { balance: -amount }, $push: { transactions: tx } })

    } else {
        res.status(404).json({ message: 'User not found' });
    }
});

app.post('/webhooks/betgames/rewards', async (req, res) => {
    const { access_token, transaction_id, amount } = req.body;

    if (!access_token) return res.status(400).json({ message: 'Missing access_token' }).end()

    if (!transaction_id) return res.status(400).json({ message: 'Missing transaction_id' }).end()

    if (!amount) return res.status(400).json({ message: 'Missing amount' }).end()

    if (typeof amount !== "number") return res.status(400).json({ message: 'Amount must be a number' }).end()

    if (amount < 0) return res.status(400).json({ message: 'Amount must be positive' }).end()

    const user = await client.db('global').collection('users').findOne({ access_token })

    if (!user) return res.status(404).json({ message: 'User not found' }).end()

    const tx = user.transactions.find((t) => t.id == transaction_id);

    if (!tx) return res.status(404).json({ message: 'Transaction not found' }).end()

    if (tx.winned !== null) return res.status(400).json({ message: 'Transaction already rewarded' }).end()

    tx.winned = true;
    tx.received = amount;

    await client.db('global').collection('users').updateOne({ access_token }, {
        $inc: { balance: amount }, $set: { [`transactions.${user.transactions.findIndex(t => t.id === transaction_id)}`]: tx }
    })

    res.status(200).end();
});

app.post('/webhooks/betgames/loses', async (req, res) => {
    const { access_token, transaction_id } = req.body;

    if (!access_token) return res.status(400).json({ message: 'Missing access_token' });

    if (!transaction_id) return res.status(400).json({ message: 'Missing transaction_id' });

    const user = await client.db('global').collection('users').findOne({ access_token })

    if (!user) return res.status(404).json({ message: 'User not found' });

    const tx = user.transactions.find((t) => t.id == transaction_id);

    if (!tx) return res.status(404).json({ message: 'Transaction not found' });

    if (tx.winned) return res.status(400).json({ message: 'Transaction already rewarded' });

    tx.winned = false;

    await client.db('global').collection('users').updateOne({ access_token }, {
        $set: { [`transactions.${user.transactions.findIndex(t => t.id === transaction_id)}`]: tx }
    });

    res.status(200).end();
})

app.listen(port, () => {
    console.log(`App listening on port ${port}`)
})