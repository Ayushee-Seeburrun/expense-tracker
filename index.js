import express from "express";      //creates the API server
import { readFile, writeFile } from "node:fs/promises";    //allows reading and writing the json file

const app = express();      //app represents the backend server
const PORT = Number(process.env.PORT) || 8000;
const expensesFileUrl = new URL("./data/expenses.json", import.meta.url);
const expenseFields = [
  "personId",
  "date",
  "category",
  "description",
  "amount",
  "paymentMethod",
];

//can sort expenses by these fields, if other fields used in query parameter it will return an error message
const sortableExpenseFields = ["id", "date", "amount", "category", "description"];

app.use(express.json());        //allows express to parse incoming JSON requests

async function readExpenseData() {
  const fileContents = await readFile(expensesFileUrl, "utf8");
  return JSON.parse(fileContents);      //converting the string into a JS object
}

async function writeExpenseData(data) {
  const jsonContents = JSON.stringify(data, null, 2);
  await writeFile(expensesFileUrl, jsonContents, "utf8");
}

function createExpenseId(expenses) {
  const largestIdNumber = expenses.reduce((largest, expense) => {
    const idNumber = Number(expense.id.replace("expense-", ""));
    return Number.isNaN(idNumber) ? largest : Math.max(largest, idNumber);
  }, 0);

  return `expense-${String(largestIdNumber + 1).padStart(3, "0")}`;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function findEmptyFields(expense, fields) {
  return fields.filter(
    (field) =>
      expense[field] === undefined ||
      expense[field] === null ||
      expense[field] === "",
  );
}

function isValidDateFormat(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date); //regex to check if the date is in the YYYY-MM-DD format
}

function isValidMonthFormat(month) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}


//res -> used to send something back to the client,   req -> contains information sent by the client
app.get("/api/persons", async (req, res) => {
  try {
    const { persons } = await readExpenseData();    //extracting the persons property from the object and creating a variable with same name
    res.status(200).json(persons);
  } catch (error) {
    console.error("Could not read persons:", error);
    res.status(500).json({ message: "Could not retrieve persons" });
  }
});

app.get("/api/expenses", async (req, res) => {
  try {
    const { expenses } = await readExpenseData();
    const {
      personId,
      category,
      month,
      from,
      to,
      sort = "date",
      order = "desc",
      page = "1",
      limit = "20",
    } = req.query;

    if (month && !isValidMonthFormat(month)) {
      return res.status(400).json({
        message: "Month must use the YYYY-MM format",
      });
    }

    if (from && !isValidDateFormat(from)) {
      return res.status(400).json({
        message: "From date must use the YYYY-MM-DD format",
      });
    }

    if (to && !isValidDateFormat(to)) {
      return res.status(400).json({
        message: "To date must use the YYYY-MM-DD format",
      });
    }

    if (from && to && from > to) {
      return res.status(400).json({
        message: "From date cannot be later than to date",
      });
    }

    if (!sortableExpenseFields.includes(sort)) {
      return res.status(400).json({
        message: `Sort must be one of: ${sortableExpenseFields.join(", ")}`,
      });
    }

    if (order !== "asc" && order !== "desc") {
      return res.status(400).json({
        message: "Order must be asc or desc",
      });
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      return res.status(400).json({
        message: "Page must be a positive whole number",
      });
    }

    if (
      !Number.isInteger(limitNumber) ||
      limitNumber < 1 ||
      limitNumber > 100
    ) {
      return res.status(400).json({
        message: "Limit must be a whole number between 1 and 100",
      });
    }

    let filteredExpenses = expenses;

    if (personId) {
      filteredExpenses = filteredExpenses.filter(
        (expense) => expense.personId === personId,
      );
    }

    if (category) {
      filteredExpenses = filteredExpenses.filter(
        (expense) =>
          expense.category.toLowerCase() === category.toLowerCase(),
      );
    }

    if (month) {
      filteredExpenses = filteredExpenses.filter(
        (expense) => expense.date.startsWith(month),
      );
    }

    if (from) {
      filteredExpenses = filteredExpenses.filter(
        (expense) => expense.date >= from,
      );
    }

    if (to) {
      filteredExpenses = filteredExpenses.filter(
        (expense) => expense.date <= to,
      );
    }

    const sortedExpenses = [...filteredExpenses].sort((first, second) => {
      let comparison;

      if (sort === "amount") {
        comparison = first.amount - second.amount;
      } else {
        comparison = String(first[sort]).localeCompare(String(second[sort]));
      }

      return order === "desc" ? -comparison : comparison;
    });

    const totalItems = sortedExpenses.length;
    const totalPages = Math.ceil(totalItems / limitNumber);
    const startIndex = (pageNumber - 1) * limitNumber;
    const paginatedExpenses = sortedExpenses.slice(
      startIndex,
      startIndex + limitNumber,
    );

    res.status(200).json({
      data: paginatedExpenses,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalItems,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1,
      },
      sorting: {
        field: sort,
        order,
      },
    });
  } catch (error) {
    console.error("Could not read expenses:", error);
    res.status(500).json({ message: "Could not retrieve expenses" });
  }
});

app.post("/api/expenses", async (req, res) => {
  try {
    if (!isObject(req.body)) {
      return res.status(400).json({ message: "Request body must be a JSON object" });
    }

    const missingFields = findEmptyFields(req.body, expenseFields);

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: "Missing required fields",
        fields: missingFields,
      });
    }

    const amount = Number(req.body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        message: "Amount must be a number greater than zero",
      });
    }

    if (!isValidDateFormat(req.body.date)) {
      return res.status(400).json({
        message: "Date must use the YYYY-MM-DD format",
      });
    }

    const data = await readExpenseData();
    const personExists = data.persons.some(
      (person) => person.id === req.body.personId,
    );

    if (!personExists) {
      return res.status(404).json({ message: "Person not found" });
    }

    const newExpense = {
      id: createExpenseId(data.expenses),
      personId: req.body.personId,
      date: req.body.date,
      category: req.body.category,
      description: req.body.description,
      amount,
      paymentMethod: req.body.paymentMethod,
    };

    data.expenses.push(newExpense);
    await writeExpenseData(data);

    res.status(201).json(newExpense);
  } catch (error) {
    console.error("Could not create expense:", error);
    res.status(500).json({ message: "Could not create expense" });
  }
});

app.get("/api/expenses/:id", async (req, res) => {
  try {
    const { expenses } = await readExpenseData();
    const expense = expenses.find((item) => item.id === req.params.id);

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.status(200).json(expense);
  } catch (error) {
    console.error("Could not read expense:", error);
    res.status(500).json({ message: "Could not retrieve expense" });
  }
});

app.put("/api/expenses/:id", async (req, res) => {
  try {
    // checking if the request body is a valid JSON object
    if (!isObject(req.body)) {
      return res.status(400).json({ message: "Request body must be a JSON object" });
    }

    const missingFields = findEmptyFields(req.body, expenseFields);

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: "PUT requires every expense field",
        fields: missingFields,
      });
    }

    const amount = Number(req.body.amount); // converts the value entered in the amount field to a number "250" becomes 250

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        message: "Amount must be a number greater than zero",
      });
    }

    if (!isValidDateFormat(req.body.date)) {
      return res.status(400).json({
        message: "Date must use the YYYY-MM-DD format",
      });
    }

    // finding the specific expense that we want to update with the new data provided in the request body
    //we look by expense id which is unique for each expense
    const data = await readExpenseData();
    const expenseIndex = data.expenses.findIndex(
      (expense) => expense.id === req.params.id,   
    // (expense) is like function parameter, expense.id accesses the id of the current expense object and compares it to id in request parameter
    );

    if (expenseIndex === -1) {
      return res.status(404).json({ message: "Expense not found" });
    }

    const personExists = data.persons.some(
      (person) => person.id === req.body.personId,
    );

    if (!personExists) {
      return res.status(404).json({ message: "Person not found" });
    }

    const updatedExpense = {
      id: data.expenses[expenseIndex].id,   //id is kept, it cannot be changed
      personId: req.body.personId,
      date: req.body.date,
      category: req.body.category,
      description: req.body.description,
      amount,
      paymentMethod: req.body.paymentMethod,
    };

    // e.g data.expenses[1] = updatedExpense;  replacing old expense object with new one at same index
    data.expenses[expenseIndex] = updatedExpense;
    await writeExpenseData(data);

    res.status(200).json(updatedExpense);
  } catch (error) {
    console.error("Could not replace expense:", error);
    res.status(500).json({ message: "Could not replace expense" });
  }
});

app.patch("/api/expenses/:id", async (req, res) => {
  try {
    if (!isObject(req.body)) {
      return res.status(400).json({ message: "Request body must be a JSON object" });
    }

    const fieldsToUpdate = Object.keys(req.body);

    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({ message: "Provide at least one field to update" });
    }

    const unsupportedFields = fieldsToUpdate.filter(
      (field) => !expenseFields.includes(field),
    );

    if (unsupportedFields.length > 0) {
      return res.status(400).json({
        message: "Unsupported expense fields",
        fields: unsupportedFields,
      });
    }

    const emptyFields = findEmptyFields(req.body, fieldsToUpdate);

    if (emptyFields.length > 0) {
      return res.status(400).json({
        message: "Updated fields cannot be empty",
        fields: emptyFields,
      });
    }

    let amount;

    if (fieldsToUpdate.includes("amount")) {
      amount = Number(req.body.amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          message: "Amount must be a number greater than zero",
        });
      }
    }

    if (
      fieldsToUpdate.includes("date") &&
      !isValidDateFormat(req.body.date)
    ) {
      return res.status(400).json({
        message: "Date must use the YYYY-MM-DD format",
      });
    }

    const data = await readExpenseData();
    const expenseIndex = data.expenses.findIndex(
      (expense) => expense.id === req.params.id,
    );

    if (expenseIndex === -1) {
      return res.status(404).json({ message: "Expense not found" });
    }

    if (fieldsToUpdate.includes("personId")) {
      const personExists = data.persons.some(
        (person) => person.id === req.body.personId,
      );

      if (!personExists) {
        return res.status(404).json({ message: "Person not found" });
      }
    }

    const updatedExpense = {
      ...data.expenses[expenseIndex],
      ...req.body,
    };

    if (fieldsToUpdate.includes("amount")) {
      updatedExpense.amount = amount;
    }

    data.expenses[expenseIndex] = updatedExpense;
    await writeExpenseData(data);

    res.status(200).json(updatedExpense);
  } catch (error) {
    console.error("Could not update expense:", error);
    res.status(500).json({ message: "Could not update expense" });
  }
});

app.delete("/api/expenses/:id", async (req, res) => {
  try {
    const data = await readExpenseData();
    const expenseIndex = data.expenses.findIndex(
      (expense) => expense.id === req.params.id,
    );

    if (expenseIndex === -1) {
      return res.status(404).json({ message: "Expense not found" });
    }

    data.expenses.splice(expenseIndex, 1);
    await writeExpenseData(data);

    res.status(204).send();
  } catch (error) {
    console.error("Could not delete expense:", error);
    res.status(500).json({ message: "Could not delete expense" });
  }
});

app.get("/api/persons/:personId/expenses", async (req, res) => {
  try {
    const { persons, expenses } = await readExpenseData();
    const personExists = persons.some(
      (person) => person.id === req.params.personId,
    );

    if (!personExists) {
      return res.status(404).json({ message: "Person not found" });
    }

    const personExpenses = expenses.filter(
      (expense) => expense.personId === req.params.personId,
    );

    res.status(200).json(personExpenses);
  } catch (error) {
    console.error("Could not read person's expenses:", error);
    res.status(500).json({ message: "Could not retrieve person's expenses" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
