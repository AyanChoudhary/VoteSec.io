const express = require('express');
const app = express();
const server = require('http').createServer(app);
const parser = require('body-parser');
const url = require('url');
const path = require('path');
const fs = require('fs');
const Web3 = require('web3');
const crypto = require('crypto');
const CosmosClient = require('@azure/cosmos').CosmosClient;
const config = require('./config');
const endpoint = config.endpoint;
const key = config.key;
const request = require('request')

const IV_LENGTH = 16; // For AES, this is always 16
const secert = 'm1cr0s0ft_z1nd4b4d_h3nt41_h4v3n_';
function encrypt(text, ENCRYPTION_KEY) {
   let iv = crypto.randomBytes(IV_LENGTH);
   let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
   let encrypted = cipher.update(text);

   encrypted = Buffer.concat([encrypted, cipher.final()]);

   return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text, ENCRYPTION_KEY) {
 let textParts = text.split(':');
 let iv = Buffer.from(textParts.shift(), 'hex');
 let encryptedText = Buffer.from(textParts.join(':'), 'hex');
 let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
 let decrypted = decipher.update(encryptedText);

 decrypted = Buffer.concat([decrypted, decipher.final()]);

 return decrypted.toString();
}

server.listen(process.env.PORT || 2050);
console.log("Server listening on port 2050...");

app.use(parser.urlencoded({ extended: true}));

if (typeof web3 !== 'undefined') { web3 = new Web3(web3.currentProvider); }
else { web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:7545')); }

abi = '[  {    "constant": true,    "inputs": [      {        "name": "",        "type": "uint256"      }    ],    "name": "candidates",    "outputs": [      {        "name": "id",        "type": "uint32"      },      {        "name": "name",        "type": "string"      },      {        "name": "votes",        "type": "uint256"      }    ],    "payable": false,    "stateMutability": "view",    "type": "function"  },  {    "constant": true,    "inputs": [],    "name": "cancount",    "outputs": [      {        "name": "",        "type": "uint32"      }    ],    "payable": false,    "stateMutability": "view",    "type": "function"  },  {    "inputs": [],    "payable": false,    "stateMutability": "nonpayable",    "type": "constructor"  },  {    "anonymous": false,    "inputs": [      {        "indexed": false,        "name": "response",        "type": "string"      }    ],    "name": "temp",    "type": "event"  },  {    "constant": false,    "inputs": [      {        "name": "vid",        "type": "uint256"      },      {        "name": "cid",        "type": "uint256"      }    ],    "name": "castVote",    "outputs": [      {        "name": "",        "type": "string"      }    ],    "payable": false,    "stateMutability": "nonpayable",    "type": "function"  },  {    "constant": false,    "inputs": [      {        "name": "queryID",        "type": "bytes32"      },      {        "name": "result",        "type": "string"      }    ],    "name": "__callback",    "outputs": [],    "payable": false,    "stateMutability": "nonpayable",    "type": "function"  },  {    "constant": false,    "inputs": [      {        "name": "_myid",        "type": "bytes32"      },      {        "name": "_result",        "type": "string"      },      {        "name": "_proof",        "type": "bytes"      }    ],    "name": "__callback",    "outputs": [],    "payable": false,    "stateMutability": "nonpayable",    "type": "function"  },  {    "constant": false,    "inputs": [],    "name": "testOracle",    "outputs": [],    "payable": true,    "stateMutability": "payable",    "type": "function"  }]';

abiobj = JSON.parse(abi);
var defaultAccount = '0xEcebc654DC57ee532a63Ea6F2634D186963E7b24'; // Has to be updated according to the local blockchain
var contract_addr = '0xa7aeF6067Ab287b914165C0402E8E2a71B8F0C6B'; //Has to be updated everytime the contract is migrated, can be obtained via Election.deployed().address in the truffle console
election = new web3.eth.Contract(abiobj, contract_addr , {from : defaultAccount});

console.log('web3 initialized');
constituencies = JSON.parse(fs.readFileSync('constituencies.json')); //We decided to go with json for storing the constituencies list because it will be faster to have the entire tree as a state variable of the server, and this is all public information anyway.
allowed_machines = JSON.parse(fs.readFileSync('ips.json')); //list of whitelisted ips
concount = constituencies.length;
console.log(constituencies);
console.log(concount);

function verify(v,f) {
	console.log("Verify")
	var url = 'https://votesec-cosmos-api.herokuapp.com/test';
	var json = {vid: v, fprint: f}

	request.post(
		url,
		{ form: { data: encrypt(JSON.stringify(json)), key:secert } }, //DUMMY ADD ENCRYPTION
		function (error, response, body) {
			console.log("in anon fxn")
			console.log(response)
			console.log(error)
			if (!error && response.statusCode == 200) {
				console.log(body);
				if (body == 'VALID') {
					return true;
				}
				else{
					return false;
				}
			}
		}
	);
}

app.post('/getcans',function(req,res){
    if(typeof req.body.pin == 'string'){
      pin = req.body.pin;
      if(parseInt(pin)>=0){
        console.log('request ayi');
        console.log(pin);
        index = -1;
        for(i=0;i<concount;i++){
          console.log(constituencies[i].id);
          if(constituencies[i].id.toString()==pin.toString()){
            index = i;
            break;
          }
        }
        if(index == -1){
          res.status(400).send("Uh oh something went wrong");
        }
        res.send(JSON.stringify(constituencies[index]));
      }
  }
  else{
    res.status(400).send("Uh oh something went wrong");
  }
});

app.post('/voteapi',function(req,res){
  // if(allowed_machines.includes(request.connection.remoteAddress.toString())){
    vid = JSON.parse(decrypt(req.body.data,secert)).vid;
    cid = JSON.parse(decrypt(req.body.data,secert)).cid;
    var md5sum = crypto.createHash('md5');
    md5sum.update(cid);
    cid = md5sum.digest('hex');
    m5sum = null;
    fprint = JSON.parse(decrypt(req.body.data,secert)).fprint;
    election.methods.castVote(vid, cid).send({from : defaultAccount},function(e,r){ console.log(r) });
    details = queryContainer(vid);
    verification = verify(vid,fprint);
  //  }
  // else{
  //   res.status(404).send("Something went wrong")
  // }
});
