"use strict";

// Optional Online Events is limited to this exact HTTPS origin. No wildcard,
// extra domain or additional network option is accepted by development checks.
const ONLINE_EVENTS_ORIGIN = "https://generativelanguage.googleapis.com";
function approvedNetworkPermission(network) {
    return network === undefined || (network && typeof network === "object" &&
        !Array.isArray(network) && Object.keys(network).length === 1 &&
        Array.isArray(network.domains) && network.domains.length === 1 &&
        network.domains[0] === ONLINE_EVENTS_ORIGIN);
}
module.exports = { approvedNetworkPermission, ONLINE_EVENTS_ORIGIN };
