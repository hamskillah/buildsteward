# Formatting items

The existing one-argument call returns the name, a colon and space, and the price with two decimal places. Downstream consumers parse that exact format. Add an optional second argument with a `currency` field. When it is supplied, append one space and the supplied currency code. Both call styles must continue to work.
