# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript and enable type-aware lint rules. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

here is the effect I want: at each mind map update, the original mind map does not change. If the speakers are still talking about the same point, only the newest leaf on that point changes; if the speakers go on to a new point, then branch and display what has been about the new point so far. So the model needs to 1. identify when the speakers has moved on to a new point and 2. decide whether to branch off the current latest leaf node or an earlier node and create nodes parallel to the current one