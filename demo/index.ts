import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Entity } from "electrodb";
import { Person } from "./tsp-output/typespec-electrodb-emitter/entities";

const client = new DynamoDBClient();
const table = "electro";
const person = new Entity(Person, { client, table });
