import { WatchmodeClient } from "@watchmode/api-client";

const client = new WatchmodeClient({ apiKey: "lCEVkd6OJ6WSliMMHLpkbsQbChmwhXyKAFzI8Por" });

// Search for titles
const { data: results } = await client.search.byName({ searchValue: "Breaking Bad" });

// Get title details
const { data: title } = await client.title.getDetails({ id: "3173903" });

// Get streaming sources
const { data: sources } = await client.title.getSources({ id: "3173903" });
