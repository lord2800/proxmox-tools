module.exports = function (host, user, pass, realm, ca) {
	var request = require('request').defaults({
		baseUrl: 'https://' + host + ':8006/api2/json',
		agentOptions: {
			ca: ca,
			rejectUnauthorized: false
		}
	});

	var timestamp = 0;
	var authClient = null;

	function login(callback) {
		request.post('/access/ticket', { form: { username: user + '@' + realm, password: pass }, json: true }, function (err, response, body) {
			if(!body || !body.data || !body.data.CSRFPreventionToken || !body.data.ticket) {
				callback(new Error('Invalid credentials?'), null);
			}

			authClient = request.defaults({
				headers: {
					CSRFPreventionToken: body.data.CSRFPreventionToken,
					Cookie: 'PVEAuthCookie=' + body.data.ticket
				}
			});
			timestamp = Date.now();
			callback(null, {
				'get': makeRequest.bind(null, 'get'),
				'post': makeRequest.bind(null, 'post'),
				'put': makeRequest.bind(null, 'put'),
				'delete': makeRequest.bind(null, 'del')
			});
		});
	}

	function makeRequest(method, url, body, callback) {
		if(!(callback instanceof Function)) {
			callback = body;
			body = undefined;
		}

		if(!(method in request)) {
			callback(new Error('Invalid method'));
			return;
		}

		return authClient[method](url, { form: body, json: true }, callback);
	}

	return { 'login': login };
};
