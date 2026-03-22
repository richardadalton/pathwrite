
import { mount } from "svelte";
import App from "./App.svelte";
import "@daltonr/pathwrite-svelte/styles.css";
import "./style.css";

mount(App, { target: document.getElementById("app")! });

