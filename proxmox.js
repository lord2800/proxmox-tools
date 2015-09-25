module.exports = function (host, user, pass, realm, ca) {
	var request = require('request').defaults({ agentOptions: { ca: ca, rejectUnauthorized: false } }),
		path = require('path');

	var timestamp = 0;
	var authClient = null;
	var endpoint = 'https://' + host + ':8006';

	function login(callback) {
		request.post(endpoint + path.join('/api2', 'json', 'access', 'ticket'), { form: { username: user + '@' + realm, password: pass }, json: true }, function (err, response, body) {
			if(!body || !body.data || !body.data.CSRFPreventionToken || !body.data.ticket) {
				callback(new Error('Invalid credentials?'), null);
			}

			authClient = request.defaults({ headers: { CSRFPreventionToken: body.data.CSRFPreventionToken, Cookie: 'PVEAuthCookie=' + body.data.ticket } });
			timestamp = Date.now();
			callback(null, { 'get': doRequest.bind(null, 'get'), 'post': doRequest.bind(null, 'post'), 'put': doRequest.bind(null, 'put') });
		});
	}

	function doRequest(method, url, body, callback) {
		if(!(callback instanceof Function)) {
			callback = body;
			body = undefined;
		}

		if(!(method in request)) {
			callback(new Error('Invalid method'), null);
			return;
		}

		authClient[method](endpoint + path.join('/api2', 'json', url), { json: true }, callback);
	}

	return { 'login': login };
};
