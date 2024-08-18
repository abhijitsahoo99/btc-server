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
        }
        return true;
    }

    addTransaction(transaction) {
        // Verify the transaction signature here
        if (!this.verifyTransaction(transaction)) {
            throw new Error('Invalid transaction signature');
        }
        this.pendingTransactions.push(transaction);
    }

    verifyTransaction(transaction) {
        if (transaction.fromAddress === null) return true;

        const publicKey = crypto.createPublicKey(transaction.fromAddress);
        const verifier = crypto.createVerify('SHA256');
        verifier.update(transaction.fromAddress + transaction.toAddress + transaction.amount);
        return verifier.verify(publicKey, transaction.signature, 'hex');
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

const minerAddress = crypto.randomBytes(32).toString('hex');
console.log('Miner address:', minerAddress);

const ws = new WebSocket('ws://localhost:8080');

const blockchain = new Blockchain();

ws.on('open', function open() {
    console.log('Connected to central server');
});

ws.on('message', function incoming(data) {
    const message = JSON.parse(data);
    console.log('Received:', message);

    switch (message.type) {
        case 'NEW_PENDING_TRANSACTION':
            blockchain.addTransaction(message.transaction);
            break;
        case 'NEW_BLOCK':
            // Verify the new block before adding it to the chain
            if (blockchain.isChainValid()) {
                blockchain.chain.push(message.block);
                console.log('New block added to the chain');
            } else {
                console.log('Received invalid block. Rejecting.');
            }
            break;
        case 'BLOCKCHAIN_STATE':
            // Update the local blockchain if the received one is longer and valid
            if (message.data.length > blockchain.chain.length && blockchain.isChainValid()) {
                blockchain.chain = message.data;
                console.log('Updated local blockchain to the latest state');
            }
            break;
    }
});

// Start mining
setInterval(() => {
    console.log('Mining new block...');
    blockchain.minePendingTransactions(minerAddress);
    ws.send(JSON.stringify({
        type: 'MINE_BLOCK',
        block: blockchain.getLatestBlock(),
        miningRewardAddress: minerAddress
    }));
}, 10000); // Mine a new block every 10 seconds