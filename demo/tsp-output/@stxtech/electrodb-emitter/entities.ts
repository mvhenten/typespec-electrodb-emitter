export default {
  Person: {
    attributes: {
      pk: {
        type: "string",
        required: true,
        label: undefined
      },
      id: {
        type: "string",
        required: true,
        label: undefined
      },
      firstName: {
        type: "string",
        required: true,
        label: "fn"
      },
      createdAt: {
        type: "number",
        label: "cat",
        watch: "*",
        required: true,
        default: () => Date.now(),
        set: () => Date.now()
      },
      updatedAt: {
        type: "number",
        readOnly: true,
        required: true,
        default: () => Date.now(),
        set: () => Date.now()
      },
      birthDate: {
        type: "string",
        required: true,
        label: undefined
      },
      age: {
        type: "number",
        required: true,
        label: undefined
      },
      address: {
        type: "map",
        properties: {
          street: {
            type: "string",
            required: true
          },
          country: {
            type: "set",
            items: ["NL", "US", "DE"],
            required: true
          },
          type: {
            type: "string",
            required: true
          }
        },
        required: true,
        label: undefined
      },
      contact: {
        type: "list",
        items: {
          type: "map",
          properties: {
            value: {
              type: "string",
              required: true
            },
            description: {
              type: "string",
              required: true
            }
          }
        },
        required: true,
        label: undefined
      },
      nickName: {
        type: "string",
        required: false,
        label: undefined
      }
    },
    indexes: {},
    model: {
      entity: "person",
      service: "org",
      version: 1
    }
  }
}