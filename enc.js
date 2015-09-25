#!/usr/bin/env node
var proxmox = require('./proxmox')(process.env.PROXMOX_HOST, process.env.PROXMOX_USER, process.env.PROXMOX_PASSWORD, 'pam', require('fs').readFileSync(process.env.PROXMOX_CA_CERT)),
	path = require('path'),
	yaml = require('js-yaml'),
	puppetdb = require('node-puppetdbquery'),
	request = require('request');

var nodename = process.argv[2];

var query = encodeURIComponent(JSON.stringify(puppetdb.parse('clientcert="' + nodename + '"')));

var url = 'http://' + path.join(process.env.PUPPETDB_HOST, 'pdb', 'query', 'v4', 'facts') + '?query=' + query;
request.get({url: url, json: true}, function (err, resp, body) {
	if(err) throw err;
	if(resp.statusCode !== 200) throw new Error(resp.statusMessage);

	var facts = body.reduce(function (result, entry) {
		if(entry.name === 'vmid' || entry.name === 'vmnode') {
			result[entry.name] = entry.value;
		}
		return result;
	}, {});

	if(!facts.vmnode || !facts.vmid) throw new Error('Invalid or unknown node ' + nodename);

	proxmox.login(function (err, client) {
		if(err) throw err;

		client.get(path.join('/nodes', facts.vmnode, 'qemu', facts.vmid, 'config'), function (err, resp, body) {
			if(err) throw err;

			console.log('---');
			console.log(yaml.dump(JSON.parse(body.data.description)));
		});
	});
});
