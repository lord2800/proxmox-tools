#!/usr/bin/env node
var proxmox = require('./proxmox')(process.env.PROXMOX_HOST, process.env.PROXMOX_USER, process.env.PROXMOX_PASSWORD, 'pam', require('fs').readFileSync(process.env.PROXMOX_CA_CERT)),
	path = require('path'),
	program = require('commander'),
	util = require('util'),
	uuid = require('node-uuid'),
	prompt = require('prompt'),
	dump = util.inspect.bind(util)
;

function parseBase10(v) { return parseInt(v, 10); }
function random(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function buildVM(node, name, id, options) {
	var vm = {
		vmid: id,
		name: name,
		ostype: 'l26',
		ide0: options.storage + ':6,format=qcow2,discard=on,cache=writethrough',
		sockets: options.sockets,
		cores: options.cores,
		numa: 0,
		net0: 'e1000,bridge=vmbr0',
		kvm: 1,
		tablet: 0,
		cpu: 'kvm64',
		onboot: 1,
	};

	var hostname = options.host || (name + '.crimescene.xyz');

	var bios = {
		uuid: uuid.v4(),
		manufacturer: node,
		product: hostname,
		version: options.provisioner,
		serial: id
	};

	var smbios = '';
	Object.keys(bios).forEach(function (prop) {
		smbios += prop + '=' + bios[prop] + ',';
	});
	vm.smbios1 = smbios.substr(0, smbios.length-1);

	vm.storage = options.storage;

	if(options.mem) {
		vm.memory = options.mem;
		vm.balloon = 0;
	} else if(options.min && options.max && options.min > options.max) {
		vm.memory = options.max;
		vm.balloon = options.min;
	} else {
		throw new Error('Invalid memory settings');
	}

	if(options.cd) {
		vm.cdrom = options.cd + ',media=cdrom';
	}

	if(options.pool) {
		vm.pool = options.pool;
	}

	return vm;
}

program.version(require('./package').version);

program
	.command('get <node> <id>')
	.description('get an existing vm')
	.action(function (node, id) {
		proxmox.login(function (err, client) {
			if(err) {
				console.log('Failed to login: %j', err);
				process.exit(-1);
			}

			client.get(path.join('/nodes', node, 'qemu', id, 'config'), function (err, resp, body) {
				console.log(dump(body.data));
			});
		});
	});

program
	.command('create <node> <name> <id>')
	.description('create a new vm')
	.option('--host <hostname>', 'The hostname')
	.option('--provisioner <provisioner>', 'The provisioner setting', 'none')
	.option('-c, --cores <cores>', 'Number of cores', parseBase10, 1)
	.option('-s, --sockets <sockets>', 'Number of sockets', parseBase10, 1)
	.option('--min <min>', 'The minimum memory amount', parseBase10)
	.option('--max <max>', 'The maximum memory amount', parseBase10)
	.option('--mem <amount>', 'The fixed memory amount', parseBase10, 256)
	.option('--storage <storage>', 'The storage to put the disk on', 'local')
	.option('--cd <cd>', 'The CD to use to boot with')
	.option('--pool <pool>', 'The pool to assign')
	.action(function (node, name, id, options) {
		var vm = buildVM(node, name, id, options);

		proxmox.login(function (err, client) {
			if(err) {
				console.log('Failed to login: %j', err);
				process.exit(-1);
			}

			console.log('Creating vm ' + id + ' with name ' + name + ' on node ' + node);
			client.post(path.join('/nodes', node, 'qemu'), vm, function (err, resp, body) {
				console.log(dump(body.data));
			});
		});
	});

program
	.command('destroy <node> <id>')
	.description('destroy a vm')
	.action(function (node, id) {
		var num = String(random(100, 999));
		prompt.start();
		prompt.message = 'Enter ' + num + ' to continue:';
		prompt.get(['number'], function (err, result) {
			if(err || result.number !== num) {
				console.log('You entered ' + result.number + ', doing nothing...');
				process.exit(-1);
			}

			proxmox.login(function (err, client) {
				if(err) {
					console.log('Failed to login: %j', err);
					process.exit(-1);
				}

				console.log('Destroying vm ' + id + ' of node ' + node);
				client.delete(path.join('/nodes', node, 'qemu', id), function (err, resp, body) {
					console.log(dump(body.data));
				});
			});
		});
	});

program
	.command('stop <node> <id>')
	.description('stop a vm')
	.option('--force', 'Force the vm to stop')
	.option('--suspend', 'Suspend the vm instead')
	.action(function (node, id, options) {
		if(options.suspend && options.force) {
			console.log('You cannot force a suspend!');
			process.exit(-1);
		}

		var num = String(random(100, 999));
		prompt.start();
		prompt.message = 'Enter ' + num + ' to continue:';
		prompt.get(['number'], function (err, result) {
			if(err || result.number !== num) {
				console.log('You entered ' + result.number + ', doing nothing...');
				process.exit(-1);
			}

			proxmox.login(function (err, client) {
				if(err) {
					console.log('Failed to login: %j', err);
					process.exit(-1);
				}
			});

			var op = options.suspend ? 'Suspend' : options.force ? 'Stop' : 'Shutdown';
			console.log(op + 'ing vm ' + id + ' of node ' + node);
			client.post(path.join('/nodes', node, 'qemu', id, 'status', op.toLowerCase()), function () {
				console.log(dump(body.data));
			});
		});
	});

program
	.command('start <node> <id>')
	.description('start a vm')
	.action(function (node, id) {
		proxmox.login(function (err, client) {
			if(err) {
				console.log('Failed to login: %j', err);
				process.exit(-1);
			}
		});

		console.log('Starting vm ' + id + ' of node ' + node);
		client.post(path.join('/nodes', node, 'qemu', id, 'status', 'start'), function () {
			console.log(dump(body.data));
		});
	});

program.parse(process.argv);
