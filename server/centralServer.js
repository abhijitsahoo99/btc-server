const WebSocket = require('ws');
const crypto = require('crypto');

class Block {
    constructor(index, previousHash, transactions, timestamp = Date.now()) {
        this.index = index;
        this.previousHash = previousHash;
        this.transactions = transactions;
        this.timestamp = timestamp;
        this.nonce = 0;
        this.hash = this.calculateHash();
    }

    calculateHash() {
        return crypto.createHash('sha256').update(
            this.index +
            this.previousHash +
            JSON.stringify(this.transactions) +
            this.timestamp +
            this.nonce
        ).digest('hex');
    }

    mineBlock(difficulty) {
        while (this.hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")) {
            this.nonce++;
            this.hash = this.calculateHash();
        }
        console.log("Block mined: " + this.hash);
    }
}

class Blockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()];
        this.difficulty = 4;
        this.pendingTransactions = [];
        this.miningReward = 100;
    }

    createGenesisBlock() {
        return new Block(0, "0", [], "01/01/2023");
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    addBlock(newBlock) {
        newBlock.previousHash = this.getLatestBlock().hash;
        newBlock.mineBlock(this.difficulty);
        this.chain.push(newBlock);
    }

    isChainValid() {
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            if (currentBlock.hash !== currentBlock.calculateHash()) {
                return false;
            }

            if (currentBlock.previousHash !== previousBlock.hash) {
                return false;
            }

            // Check if the current blockchain is longer than incoming ones
            if (this.chain.length < i + 1) {
                return false;
            }
        }
        return true;
    }

    addTransaction(transaction) {
        this.pendingTransactions.push(transaction);
    }

    minePendingTransactions(miningRewardAddress) {
        const rewardTx = {
            fromAddress: null,
            toAddress: miningRewardAddress,
            amount: this.miningReward
        };
        this.pendingTransactions.push(rewardTx);

        let block = new Block(this.chain.length, this.getLatestBlock().hash, this.pendingTransactions);
        block.mineBlock(this.difficulty);

        console.log('Block successfully mined!');
        this.chain.push(block);

        this.pendingTransactions = [];
    }

    getBalanceOfAddress(address) {
        let balance = 0;

        for (const block of this.chain) {
            for (const trans of block.transactions) {
                if (trans.fromAddress === address) {
                    balance -= trans.amount;
                }
                if (trans.toAddress === address) {
                    balance += trans.amount;
                }
            }
        }

        return balance;
    }
}

// Central WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

const blockchain = new Blockchain();

wss.on('connection', (ws) => {
    console.log('New client connected');

    // Send the current blockchain state to the new client
    ws.send(JSON.stringify({
        type: 'BLOCKCHAIN_STATE',
        data: blockchain.chain
    }));

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        console.log('Received:', data);

        switch (data.type) {
            case 'NEW_TRANSACTION':
                blockchain.addTransaction(data.transaction);
                broadcastMessage({ type: 'NEW_PENDING_TRANSACTION', transaction: data.transaction });
                break;
            case 'MINE_BLOCK':
                blockchain.minePendingTransactions(data.miningRewardAddress);
                broadcastMessage({ type: 'NEW_BLOCK', block: blockchain.getLatestBlock() });
                break;
            case 'GET_BLOCKCHAIN':
                ws.send(JSON.stringify({ type: 'BLOCKCHAIN', chain: blockchain.chain }));
                break;
        }
    });
});

function broadcastMessage(message) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

console.log('Central WebSocket server started on ws://localhost:8080');