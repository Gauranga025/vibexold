"use client";
import React, { useEffect, useState, useRef } from "react";

import { transformToWebContainerFormat } from "../hooks/transformer";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

import { WebContainer } from "@webcontainer/api";
import { TemplateFolder } from "@/modules/playground/lib/path-to-json";
import TerminalComponent from "./terminal";

// Priority order for auto-detecting which script boots a dev/preview server.
// "dev" is checked first because it's the conventional script for a live,
// unbuilt preview server (next dev, vite, astro dev, etc.); "start" second
// because several starters (CRA, Angular CLI, plain Node servers) use it for
// exactly that purpose; "serve"/"preview" last because in this repo they are
// used by a minority of templates (e.g. Vue CLI's "serve").
const STARTUP_SCRIPT_PRIORITY = ["dev", "start", "serve", "preview"] as const;

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

/**
 * Reads and parses package.json from the mounted WebContainer filesystem.
 * Returns null if it can't be read or parsed — callers decide how to react.
 */
async function readMountedPackageJson(
  instance: WebContainer
): Promise<{ scripts?: Record<string, string> } | null> {
  try {
    const raw = await instance.fs.readFile("package.json", "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Picks the first script name present in STARTUP_SCRIPT_PRIORITY.
 * Returns null if none of the priority scripts exist, so the caller can show
 * an actionable error instead of guessing.
 */
function selectStartupScript(
  scripts: Record<string, string> | undefined
): string | null {
  if (!scripts) return null;
  for (const candidate of STARTUP_SCRIPT_PRIORITY) {
    if (typeof scripts[candidate] === "string") return candidate;
  }
  return null;
}

/**
 * Runs a short-lived command (e.g. `node --version`) inside the WebContainer
 * and returns its combined stdout/stderr as a trimmed string. Used only for
 * preflight diagnostics, not for the long-running install/start processes.
 */
async function captureCommandOutput(
  instance: WebContainer,
  command: string,
  args: string[]
): Promise<string> {
  try {
    const process = await instance.spawn(command, args);
    let output = "";
    await process.output.pipeTo(
      new WritableStream({
        write(data) {
          output += data;
        },
      })
    );
    await process.exit;
    return output.trim();
  } catch (err) {
    return `unavailable (${err instanceof Error ? err.message : String(err)})`;
  }
}

/**
 * Pipes a spawned process's output to the terminal while tracking elapsed
 * time and detecting output stalls, matching the diagnostics requested for
 * the install and startup phases. Returns the process's exit code.
 */
async function streamProcessWithDiagnostics(
  process: Awaited<ReturnType<WebContainer["spawn"]>>,
  writeLine: (msg: string) => void,
  options: { phaseLabel: string; stallWarningMs?: number }
): Promise<number> {
  const stallWarningMs = options.stallWarningMs ?? 30_000;
  const startedAt = Date.now();
  let lastOutputAt = Date.now();
  let stalled = false;

  const stallInterval = setInterval(() => {
    const sinceLastOutput = Date.now() - lastOutputAt;
    if (!stalled && sinceLastOutput >= stallWarningMs) {
      stalled = true;
      writeLine(
        `⚠️  No ${options.phaseLabel} output received for ${Math.floor(
          sinceLastOutput / 1000
        )} seconds... (elapsed: ${formatElapsed(Date.now() - startedAt)})\r\n`
      );
    }
  }, 5_000);

  try {
    await process.output.pipeTo(
      new WritableStream({
        write(data) {
          lastOutputAt = Date.now();
          stalled = false;
          writeLine(data);
        },
      })
    );
  } finally {
    clearInterval(stallInterval);
  }

  const exitCode = await process.exit;
  writeLine(
    `\r\nℹ️  ${options.phaseLabel} finished in ${formatElapsed(
      Date.now() - startedAt
    )} (exit code ${exitCode})\r\n`
  );
  return exitCode;
}

interface WebContainerPreviewProps {
  templateData: TemplateFolder;
  serverUrl: string;
  isLoading: boolean;
  error: string | null;
  instance: WebContainer | null;
  writeFileSync: (path: string, content: string) => Promise<void>;
  forceResetup?: boolean; // Optional prop to force re-setup
}
const WebContainerPreview = ({
  templateData,
  error,
  instance,
  isLoading,
  serverUrl,
  writeFileSync,
  forceResetup = false,
}: WebContainerPreviewProps) => {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [loadingState, setLoadingState] = useState({
    transforming: false,
    mounting: false,
    installing: false,
    starting: false,
    ready: false,
  });
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 4;
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isSetupInProgress, setIsSetupInProgress] = useState(false);

  const terminalRef = useRef<any>(null);

  // Reset setup state when forceResetup changes
  useEffect(() => {
    if (forceResetup) {
      setIsSetupComplete(false);
      setIsSetupInProgress(false);
      setPreviewUrl("");
      setCurrentStep(0);
      setLoadingState({
        transforming: false,
        mounting: false,
        installing: false,
        starting: false,
        ready: false,
      });
    }
  }, [forceResetup]);

  useEffect(() => {
    // Single helper for all terminal writes — replaces the ~10 repeated
    // `if (terminalRef.current?.writeToTerminal) { ... }` guards that were
    // scattered through this function with no behavior change.
    const writeLine = (msg: string) => {
      terminalRef.current?.writeToTerminal?.(msg);
    };

    async function setupContainer() {
      if (!instance || isSetupComplete || isSetupInProgress) return;

      try {
        setIsSetupInProgress(true);
        setSetupError(null);

        try {
          const packageJsonExists = await instance.fs.readFile(
            "package.json",
            "utf8"
          );

          if (packageJsonExists) {
            // Files are already mounted, just reconnect to existing server
            writeLine("🔄 Reconnecting to existing WebContainer session...\r\n");

            instance.on("server-ready", (port: number, url: string) => {
              writeLine(`🌐 Reconnected to server at ${url}\r\n`);
              setPreviewUrl(url);
              setLoadingState((prev) => ({
                ...prev,
                starting: false,
                ready: true,
              }));
            });

            setCurrentStep(4);
            setLoadingState((prev) => ({ ...prev, starting: true }));
            return;
          }
        } catch (error) {}

        // Step-1 transform data
        setLoadingState((prev) => ({ ...prev, transforming: true }));
        setCurrentStep(1);
        writeLine("🔄 Transforming template data...\r\n");

        // @ts-ignore
        const files = transformToWebContainerFormat(templateData);
        setLoadingState((prev) => ({
          ...prev,
          transforming: false,
          mounting: true,
        }));
        setCurrentStep(2);

        // Step-2 Mount Files
        writeLine("📁 Mounting files to WebContainer...\r\n");
        await instance.mount(files);
        writeLine("✅ Files mounted successfully\r\n");

        setLoadingState((prev) => ({
          ...prev,
          mounting: false,
          installing: true,
        }));
        setCurrentStep(3);

        // Step-3 Install dependencies — with preflight + streamed diagnostics
        const [pwdOutput, nodeVersion, npmVersion] = await Promise.all([
          captureCommandOutput(instance, "pwd", []),
          captureCommandOutput(instance, "node", ["--version"]),
          captureCommandOutput(instance, "npm", ["--version"]),
        ]);
        const mountedPackageJson = await readMountedPackageJson(instance);
        const detectedScripts = Object.keys(mountedPackageJson?.scripts ?? {});

        writeLine("── Preflight ──────────────────────────\r\n");
        writeLine(`Working directory : ${pwdOutput || "/"}\r\n`);
        writeLine(`Node version      : ${nodeVersion}\r\n`);
        writeLine(`npm version       : ${npmVersion}\r\n`);
        writeLine(`Package manager   : npm (hardcoded install command)\r\n`);
        writeLine(
          `Detected scripts  : ${
            detectedScripts.length ? detectedScripts.join(", ") : "(none found)"
          }\r\n`
        );
        writeLine("────────────────────────────────────────\r\n");

        writeLine("📦 Installing dependencies (npm install)...\r\n");
        const installProcess = await instance.spawn("npm", ["install"]);
        const installExitCode = await streamProcessWithDiagnostics(
          installProcess,
          writeLine,
          { phaseLabel: "npm install" }
        );

        if (installExitCode !== 0) {
          throw new Error(
            `Failed to install dependencies. Exit code: ${installExitCode}. ` +
              `See the terminal output above for npm's actual stderr.`
          );
        }
        writeLine("✅ Dependencies installed successfully\r\n");

        setLoadingState((prev) => ({
          ...prev,
          installing: false,
          starting: true,
        }));
        setCurrentStep(4);

        // Step-4 Start the server — dynamically selected, not hardcoded.
        // Re-read package.json post-install in case a postinstall step changed it.
        const postInstallPackageJson = await readMountedPackageJson(instance);
        const startupScripts = Object.keys(
          postInstallPackageJson?.scripts ?? {}
        );
        const selectedScript = selectStartupScript(
          postInstallPackageJson?.scripts
        );

        writeLine(
          `Detected scripts: ${
            startupScripts.length ? startupScripts.join(", ") : "(none found)"
          }\r\n`
        );

        if (!selectedScript) {
          throw new Error(
            "This template does not expose a runnable script. Expected one " +
              `of "${STARTUP_SCRIPT_PRIORITY.join('", "')}" in package.json's ` +
              `"scripts" field, but found: ${
                startupScripts.length ? startupScripts.join(", ") : "none"
              }.`
          );
        }

        writeLine(`Selected startup command: npm run ${selectedScript}\r\n`);
        writeLine("🚀 Starting development server...\r\n");

        const startProcess = await instance.spawn("npm", [
          "run",
          selectedScript,
        ]);

        // Local flag instead of reading the `isSetupComplete` state variable
        // from the closure: that state was captured at the time this effect
        // ran (always false here) and would never reflect the server-ready
        // event firing later, which would make the exit-code check below
        // report a false failure even after a successful startup.
        let serverBecameReady = false;

        instance.on("server-ready", (port: number, url: string) => {
          serverBecameReady = true;
          writeLine(`🌐 Server ready at ${url}\r\n`);
          setPreviewUrl(url);
          setLoadingState((prev) => ({
            ...prev,
            starting: false,
            ready: true,
          }));
          setIsSetupComplete(true);
          setIsSetupInProgress(false);
        });

        // Stream the start process's output with the same diagnostics used
        // for install. If the process exits before server-ready ever fires,
        // surface the real stderr instead of leaving the UI stuck on
        // "Starting development server...".
        streamProcessWithDiagnostics(startProcess, writeLine, {
          phaseLabel: `npm run ${selectedScript}`,
        }).then((startExitCode) => {
          if (startExitCode !== 0 && !serverBecameReady) {
            const failureMessage =
              `Startup command "npm run ${selectedScript}" exited with code ` +
              `${startExitCode} before the server became ready. Check the ` +
              `stderr above for the actual failure.`;
            writeLine(`❌ ${failureMessage}\r\n`);
            setSetupError(failureMessage);
            setIsSetupInProgress(false);
          }
        });
      } catch (err) {
        console.error("Error setting up container:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        writeLine(`❌ Error: ${errorMessage}\r\n`);
        setSetupError(errorMessage);
        setIsSetupInProgress(false);
        setLoadingState({
          transforming: false,
          mounting: false,
          installing: false,
          starting: false,
          ready: false,
        });
      }
    }

    setupContainer();
  }, [instance, templateData, isSetupComplete, isSetupInProgress]);

  useEffect(() => {
    return () => {};
  }, []);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md p-6 rounded-lg bg-gray-50 dark:bg-gray-900">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <h3 className="text-lg font-medium">Initializing WebContainer</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Setting up the environment for your project...
          </p>
        </div>
      </div>
    );
  }

  if (error || setupError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-6 rounded-lg max-w-md">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="h-5 w-5" />
            <h3 className="font-semibold">Error</h3>
          </div>
          <p className="text-sm">{error || setupError}</p>
        </div>
      </div>
    );
  }
  const getStepIcon = (stepIndex: number) => {
    if (stepIndex < currentStep) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else if (stepIndex === currentStep) {
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    } else {
      return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStepText = (stepIndex: number, label: string) => {
    const isActive = stepIndex === currentStep;
    const isComplete = stepIndex < currentStep;

    return (
      <span
        className={`text-sm font-medium ${
          isComplete
            ? "text-green-600"
            : isActive
            ? "text-blue-600"
            : "text-gray-500"
        }`}
      >
        {label}
      </span>
    );
  };

  return (
    <div className="h-full w-full flex flex-col">
      {!previewUrl ? (
        <div className="h-full flex flex-col">
          <div className="w-full max-w-md p-6 m-5 rounded-lg bg-white dark:bg-zinc-800 shadow-sm mx-auto">
            <Progress
              value={(currentStep / totalSteps) * 100}
              className="h-2 mb-6"
            />

            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3">
                {getStepIcon(1)}
                {getStepText(1, "Transforming template data")}
              </div>
              <div className="flex items-center gap-3">
                {getStepIcon(2)}
                {getStepText(2, "Mounting files")}
              </div>
              <div className="flex items-center gap-3">
                {getStepIcon(3)}
                {getStepText(3, "Installing dependencies")}
              </div>
              <div className="flex items-center gap-3">
                {getStepIcon(4)}
                {getStepText(4, "Starting development server")}
              </div>
            </div>
          </div>

          {/* Terminal */}
          <div className="flex-1 p-4">
            <TerminalComponent
              ref={terminalRef}
              webContainerInstance={instance}
              theme="dark"
              className="h-full"
            />
          </div>
        </div>
      ) : (
        <div className="h-full flex flex-col">
          <div className="flex-1">
            <iframe
              src={previewUrl}
              className="w-full h-full border-none"
              title="WebContainer Preview"
            />
          </div>

          <div className="h-64 border-t">
            <TerminalComponent
              ref={terminalRef}
              webContainerInstance={instance}
              theme="dark"
              className="h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default WebContainerPreview;
