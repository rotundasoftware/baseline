Basline is a small library that organizes application logic and data in node.js web applications into interdependent services that can be used both on the client and the server.

A baseline object is initialized on the server and on the client. The same API is used in both per request that your application receives and 

A baseline object is made up of services. A service is a module that contains application logic and potentially in-memory data that is operated on by that logic. Services may depend on each other.