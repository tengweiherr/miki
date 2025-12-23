"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const Miki = dynamic(
  () => import("miki").then((mod) => mod.Miki),
  { ssr: false }
);

interface Todo {
  id: number;
  text: string;
  done: boolean;
  urgency: number; // 1-5 scale
}

const urgencyColors = [
  "bg-slate-500", // 1 - low
  "bg-emerald-500", // 2
  "bg-amber-500", // 3
  "bg-orange-500", // 4
  "bg-rose-500", // 5 - urgent
];

const urgencyLabels = ["Low", "Normal", "Medium", "High", "Urgent"];

export default function Home() {
  // Counter state
  const [count, setCount] = useState(0);
  
  // Todo state
  const [todos, setTodos] = useState<Todo[]>([
    { id: 1, text: "Try selecting this todo", done: false, urgency: 2 },
    { id: 2, text: "Click the checkbox to complete", done: true, urgency: 1 },
    { id: 3, text: "Use Miki to inspect elements", done: false, urgency: 4 },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [newTodoUrgency, setNewTodoUrgency] = useState(3);

  const toggleTodo = (id: number) => {
    setTodos(
      todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const addTodo = () => {
    if (!inputValue.trim()) return;
    setTodos([...todos, { id: Date.now(), text: inputValue, done: false, urgency: newTodoUrgency }]);
    setInputValue("");
    setNewTodoUrgency(3);
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter((t) => t.id !== id));
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-purple-950 to-slate-900 p-8 font-sans text-white">
      <main className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <header className="text-center">
          <h1 className="bg-linear-to-r from-amber-200 via-rose-300 to-violet-400 bg-clip-text text-5xl font-bold tracking-tight text-transparent">
            Interactive Playground
          </h1>
          <p className="mt-3 text-lg text-slate-400">
            Test Miki by selecting any element below
          </p>
        </header>
        
        {/* Todo List */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm" data-testid="todo-section">
          <h2 className="mb-4 text-xl font-semibold text-amber-200">Todo List</h2>
          
          {/* Add Todo Form */}
          <div className="mb-6 rounded-xl bg-slate-800/50 p-4" data-testid="todo-form">
            <div className="flex gap-3 mb-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTodo()}
                placeholder="Add a new task..."
                className="flex-1 rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                data-testid="todo-input"
              />
              <button
                type="button"
                onClick={addTodo}
                className="rounded-xl bg-violet-500 px-6 py-3 font-medium text-white transition-all hover:bg-violet-400 active:scale-95"
                data-testid="todo-add-button"
              >
                Add
              </button>
            </div>
            
            {/* Urgency Slider for new todo */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400">Urgency:</span>
              <input
                type="range"
                min="1"
                max="5"
                value={newTodoUrgency}
                onChange={(e) => setNewTodoUrgency(Number(e.target.value))}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-700 accent-violet-500"
                data-testid="todo-urgency-slider"
              />
              <span 
                className={`rounded-lg px-3 py-1 text-xs font-medium text-white ${urgencyColors[newTodoUrgency - 1]}`}
                data-testid="todo-urgency-label"
              >
                {urgencyLabels[newTodoUrgency - 1]}
              </span>
            </div>
          </div>

          {/* Todo Items */}
          <div className="space-y-2" data-testid="todo-list">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className={`flex items-center gap-3 rounded-xl border border-white/5 bg-slate-800/50 p-4 transition-all hover:bg-slate-800 ${
                  todo.done ? "opacity-50" : ""
                }`}
                data-testid={`todo-item-${todo.id}`}
              >
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={() => toggleTodo(todo.id)}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                    todo.done
                      ? "border-emerald-500 bg-emerald-500"
                      : "border-slate-500 hover:border-slate-400"
                  }`}
                  data-testid={`todo-checkbox-${todo.id}`}
                >
                  {todo.done && (
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-label="Completed">
                      <title>Completed</title>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                
                {/* Todo Text */}
                <span className={`flex-1 ${todo.done ? "line-through text-slate-500" : "text-white"}`}>
                  {todo.text}
                </span>
                
                {/* Priority Scale (dots) */}
                <div className="flex gap-1" data-testid={`todo-priority-${todo.id}`}>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`h-2.5 w-2.5 rounded-full transition-all ${
                        level <= todo.urgency ? urgencyColors[todo.urgency - 1] : "bg-slate-600"
                      }`}
                    />
                  ))}
                </div>
                
                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => deleteTodo(todo.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition-all hover:bg-rose-500/20 hover:text-rose-400"
                  data-testid={`todo-delete-${todo.id}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          
          {todos.length === 0 && (
            <p className="text-center text-slate-500 py-8">No tasks yet. Add one above!</p>
          )}
        </section>

        <Miki />
      </main>
    </div>
  );
}
