import express from "express";      //creates the API server
import { readFile } from "node:fs/promises";    //allows to read the json file

const app = express();      //app represents the backend server
const PORT = Number(process.env.PORT) || 3000;
const expensesFileUrl = new URL("./data/expenses.json", import.meta.url);

app.use(express.json());

async function readExpenseData() {
  const fileContents = await readFile(expensesFileUrl, "utf8");
  return JSON.parse(fileContents);
}

app.get("/api/persons", async (req, res) => {
  try {
    const { persons } = await readExpenseData();
    res.status(200).json(persons);
  } catch (error) {
    console.error("Could not read persons:", error);
    res.status(500).json({ message: "Could not retrieve persons" });
  }
});

app.get("/api/expenses", async (req, res) => {
  try {
    const { expenses } = await readExpenseData();
    res.status(200).json(expenses);
  } catch (error) {
    console.error("Could not read expenses:", error);
    res.status(500).json({ message: "Could not retrieve expenses" });
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
