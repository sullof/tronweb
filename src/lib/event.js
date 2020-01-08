import TronWeb from 'index';
import utils from 'utils';
import providers from "./providers";
import querystring from "querystring";
import injectpromise from 'injectpromise';

function resultManager(events, options = {}, callback) {

    let data
    let meta
    if (!events)
        return callback('Unknown error occurred');

    if (utils.isArray(events)) {
        data = events;
    } else {
        if (events && events.data) {
            meta = events.meta
            data = events.data
        } else
            return callback(events);
    }
    let response = options.trongridCompatible
        ? {
            data: options.rawResponse === true ? data : data.map(event => utils.mapEvent(event)),
            meta
        }
        : data

    // console.log(response)

    return callback(null, response);
}

export default class Event {

    constructor(tronWeb = false) {
        if (!tronWeb || !(tronWeb instanceof TronWeb))
            throw new Error('Expected instance of TronWeb');
        this.tronWeb = tronWeb;
        this.injectPromise = injectpromise(this);
    }

    setServer(eventServer = false, healthcheck = 'healthcheck') {
        if (!eventServer)
            return this.tronWeb.eventServer = false;

        if (utils.isString(eventServer))
            eventServer = new providers.HttpProvider(eventServer);

        if (!this.tronWeb.isValidProvider(eventServer))
            throw new Error('Invalid event server provided');

        this.tronWeb.eventServer = eventServer;
        this.tronWeb.eventServer.isConnected = () => this.tronWeb.eventServer.request(healthcheck).then(() => true).catch(() => false);
    }

    getEventsByContractAddress(contractAddress = false, options = {}, callback = false) {

        options.trongridCompatible = this.tronWeb.trongridCompatible

        let {
            sinceTimestamp,
            since,
            fromTimestamp,
            eventName,
            blockNumber,
            size,
            page,
            onlyConfirmed,
            onlyUnconfirmed,
            previousLastEventFingerprint,
            previousFingerprint,
            fingerprint,
            sort,
            filters
        } = Object.assign({
            sinceTimestamp: 0,
            eventName: false,
            blockNumber: false,
            size: 20,
            page: 1
        }, options)

        if (!callback)
            return this.injectPromise(this.getEventsByContractAddress, contractAddress, options);

        fromTimestamp = fromTimestamp || sinceTimestamp || since;

        if (!this.tronWeb.eventServer)
            return callback('No event server configured');

        const routeParams = [];

        if (!this.tronWeb.isAddress(contractAddress))
            return callback('Invalid contract address provided');

        if (eventName && !contractAddress)
            return callback('Usage of event name filtering requires a contract address');

        if (typeof fromTimestamp !== 'undefined' && !utils.isInteger(fromTimestamp))
            return callback('Invalid fromTimestamp provided');

        if (!utils.isInteger(size))
            return callback('Invalid size provided');

        if (size > 200) {
            console.warn('Defaulting to maximum accepted size: 200');
            size = 200;
        }

        if (!utils.isInteger(page))
            return callback('Invalid page provided');

        if (blockNumber && !eventName)
            return callback('Usage of block number filtering requires an event name');

        if (contractAddress)
            routeParams.push(this.tronWeb.address.fromHex(contractAddress));

        if (eventName)
            routeParams.push(eventName);

        if (blockNumber)
            routeParams.push(blockNumber);

        const qs = {
            size,
            page
        }

        if (typeof filters === 'object' && Object.keys(filters).length > 0) {
            qs.filters = JSON.stringify(filters);
        }

        if (fromTimestamp) {
            qs.fromTimestamp = qs.since = fromTimestamp;
        }

        if (onlyConfirmed)
            qs.onlyConfirmed = onlyConfirmed

        if (onlyUnconfirmed && !onlyConfirmed)
            qs.onlyUnconfirmed = onlyUnconfirmed

        if (sort)
            qs.sort = sort

        fingerprint = fingerprint || previousFingerprint || previousLastEventFingerprint
        if (fingerprint)
            qs.fingerprint = fingerprint

        let endpoint = options.trongridCompatible
            ? `v1/contracts/${routeParams.join('/')}/events?${querystring.stringify(qs)}`
            : `event/contract/${routeParams.join('/')}?${querystring.stringify(qs)}`

        return this.tronWeb.eventServer
            .request(endpoint)
            .then(events => resultManager(events, options, callback))
            .catch(err => callback((err.response && err.response.data) || err));
    }


    getEventsByTransactionID(transactionID = false, options = {}, callback = false) {

        options.trongridCompatible = this.tronWeb.trongridCompatible

        if (utils.isFunction(options)) {
            callback = options;
            options = {};
        }

        if (!callback)
            return this.injectPromise(this.getEventsByTransactionID, transactionID, options);

        if (!this.tronWeb.eventServer)
            return callback('No event server configured');

        let endpoint = options.trongridCompatible
            ? `v1/transactions/${transactionID}/events`
            : `event/transaction/${transactionID}`

        return this.tronWeb.eventServer
            .request(endpoint)
            .then(events => resultManager(events, options, callback))
            .catch(err => callback((err.response && err.response.data) || err));
    }

}

