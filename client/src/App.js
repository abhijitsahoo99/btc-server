import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AlertCircle, Check, Send } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Alert, AlertDescription, AlertTitle } from './components/ui/Alert';

const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

const WebSocketServer = 'ws://localhost:8080';

const App = () => {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [blockchain, setBlockchain] = useState([]);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [logs, setLogs] = useState([]);
  const [ws, setWs] = useState(null);
  const [balance, setBalance] = useState(0);
  const [dummyRecipient, setDummyRecipient] = useState('');

  useEffect(() => {
    const socket = new WebSocket(WebSocketServer);
    setWs(socket);

    socket.onopen = () => {
      console.log('WebSocket connection established');
      addLog('Connected to server');
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleSocketMessage(data);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      addLog('WebSocket error', 'error');
    };

    socket.onclose = () => {
      console.log('WebSocket connection closed');
      addLog('Disconnected from server', 'error');
    };

    return () => {
      socket.close();
    };
  }, []);

  const handleSocketMessage = (data) => {
    switch (data.type) {
      case 'NEW_PENDING_TRANSACTION':
        addLog('New pending transaction received');
        setTransactions(prev => [...prev, data.transaction]);
        break;
      case 'NEW_BLOCK':
        addLog('New block mined and added to the blockchain');
        setBlockchain(prev => [...prev, data.block]);
        updateBalance();
        break;
      case 'BLOCKCHAIN':
        setBlockchain(data.chain);
        break;
      case 'BLOCKCHAIN_STATE':
        setBlockchain(data.data);
        break;
    }
  };

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { id: uuidv4(), message, type, timestamp: new Date() }]);
  };

  const createWallet = () => {
    const key = ec.genKeyPair();
    const publicKey = key.getPublic('hex');
    const privateKey = key.getPrivate('hex');
    setWallet({ publicKey, privateKey });
    addLog('New wallet created');

    // Create a dummy recipient address
    const dummyKey = ec.genKeyPair();
    const dummyPublicKey = dummyKey.getPublic('hex');
    setDummyRecipient(dummyPublicKey);

    // Set the recipient and amount fields
    setRecipient(dummyPublicKey);
    setAmount('1');

    addLog('Dummy recipient created and form pre-filled');
  };

  const sendTransaction = () => {
    if (!wallet) {
      addLog('Please create a wallet first', 'error');
      return;
    }

    const transaction = {
      fromAddress: wallet.publicKey,
      toAddress: recipient,
      amount: parseFloat(amount)
    };

    // Sign the transaction
    const key = ec.keyFromPrivate(wallet.privateKey);
    const signature = key.sign(wallet.publicKey + recipient + amount).toDER('hex');
    transaction.signature = signature;

    addLog('Transaction created and signed');
    addLog('Sending transaction to the network');

    ws.send(JSON.stringify({
      type: 'NEW_TRANSACTION',
      transaction
    }));

    // Reset the recipient and amount fields
    setRecipient(dummyRecipient);
    setAmount('1');
  };

  const updateBalance = () => {
    if (!wallet) return;

    // In a real implementation, we would calculate the balance based on the blockchain
    // For simplicity, we're just using a mock balance update here
    setBalance(prev => prev - parseFloat(amount));
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-4xl font-bold mb-8 text-center text-blue-600">Simplified Bitcoin-like System</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">Wallet</h2>
        {wallet ? (
          <div>
            <p className="mb-2"><strong>Public Key:</strong> {wallet.publicKey.substring(0, 20)}...</p>
            <p className="mb-4"><strong>Private Key:</strong> {wallet.privateKey.substring(0, 20)}...</p>
            <p className="mb-4"><strong>Balance:</strong> {balance} BTC</p>
          </div>
        ) : (
          <button onClick={createWallet} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors">
            Create Wallet
          </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mt-8">
        <h2 className="text-2xl font-semibold mb-4">Send Transaction</h2>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Recipient Address"
          className="w-full p-2 mb-2 border rounded"
        />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          className="w-full p-2 mb-4 border rounded"
        />
        <button onClick={sendTransaction} className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors">
          <Send className="inline-block mr-2" size={16} />
          Send Transaction
        </button>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Blockchain Visualization</h2>
        <LineChart width={600} height={300} data={blockchain} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="index" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="transactions.length" stroke="#8884d8" name="Transactions" />
          <Line type="monotone" dataKey="nonce" stroke="#82ca9d" name="Nonce" />
        </LineChart>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Activity Log</h2>
        <div className="space-y-2">
          {logs.map((log) => (
            <Alert key={log.id} variant={log.type === 'error' ? 'destructive' : 'default'}>
              {log.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              <AlertTitle>{new Date(log.timestamp).toLocaleTimeString()}</AlertTitle>
              <AlertDescription>{log.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;