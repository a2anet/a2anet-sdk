// SPDX-FileCopyrightText: 2026-present A2A Net <hello@a2anet.com>
//
// SPDX-License-Identifier: Apache-2.0

// Bun shares one process across test files, so the DOM is registered once here
// rather than by each file that needs it.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
