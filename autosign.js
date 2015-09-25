#!/usr/bin/env node
var proxmox = require('./proxmox')(process.env.PROXMOX_HOST, process.env.PROXMOX_USER, process.env.PROXMOX_PASSWORD, 'pam', require('fs').readFileSync(process.env.PROXMOX_CA_CERT)),
	forge = require('node-forge'),
	path = require('path');

var stdin = process.stdin;
var chunks = [];
stdin.on('readable', function () { while(null !== (chunk = stdin.read())) { chunks.push(chunk); } });
stdin.on('end', function () {
	var content = Buffer.concat(chunks) + '';
	var cert = forge.pki.certificationRequestFromPem(content);

	var puppetInstanceId = '1.3.6.1.4.1.34380.1.1.2';
	var puppetProduct = '1.3.6.1.4.1.34380.1.1.6';

	var extensionRequest = cert.getAttribute({name: 'extensionRequest'}).extensions;

	var facts = extensionRequest.reduce(function (result, entry) {
		if(entry.id === puppetInstanceId || entry.id === puppetProduct) {
			result[entry.id] = forge.util.decodeUtf8(entry.value).substr(2);
		}
		return result;
	}, {});

	var parts = cert.subject.getField({name: 'commonName'}).value.split('.');
	facts.nodeName = parts[0];

	proxmox.login(function (err, client) {
		if(err) {
			console.log(err);
			process.exit(-1);
		}

		client.get(path.join('/nodes', facts[puppetProduct], 'qemu', facts[puppetInstanceId], 'config'), function (err, resp, body) {
			if(err) {
				console.log(err);
				process.exit(-1);
			}
			if(body.data.name !== facts.nodeName) {
				process.exit(-1);
			}
			process.exit(0);
		});
	});
});
