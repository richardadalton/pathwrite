import { mount } from "svelte";
import App from "./App.svelte";
import "./style.css";
import "@daltonr/pathwrite-svelte/styles.css";

mount(App, { target: document.getElementById("app")! });
