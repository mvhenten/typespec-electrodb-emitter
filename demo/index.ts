import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Person } from "@demo/demo-entities";
import { Entity } from "electrodb";

const client = new DynamoDBClient();
const table = "electro";
const person = new Entity(Person, { client, table });
