using System;
using System.Diagnostics;
using System.IO;

namespace Vault
{
    class UpdateLauncher
    {
        static void Main(string[] args)
        {
            Console.Title = "Vault Auto-Patcher & Updater";
            string rootDir = AppDomain.CurrentDomain.BaseDirectory;

            Console.ForegroundColor = ConsoleColor.Magenta;
            Console.WriteLine(@"  ========================================================================");
            Console.WriteLine(@"     ██╗   ██╗ ██████╗  ██████╗   █████╗  ████████╗ ███████╗");
            Console.WriteLine(@"     ██║   ██║ ██╔══██╗ ██╔══██╗ ██╔══██╗ ╚══██╔══╝ ██╔════╝");
            Console.WriteLine(@"     ██║   ██║ ██████╔╝ ██║  ██║ ███████║    ██║    █████╗  ");
            Console.WriteLine(@"     ██║   ██║ ██╔═══╝  ██║  ██║ ██╔══██║    ██║    ██╔══╝  ");
            Console.WriteLine(@"     ╚██████╔╝ ██║      ██████╔╝ ██║  ██║    ██║    ███████╗");
            Console.WriteLine(@"      ╚═════╝  ╚═╝      ╚═════╝  ╚═╝  ╚═╝    ╚═╝    ╚══════╝");
            Console.WriteLine(@"                 [ VAULT AUTO-PATCHER - CLASSIC EDITION ]");
            Console.WriteLine(@"  ========================================================================");
            Console.ResetColor();

            Console.WriteLine("\n [*] Vault Root: " + rootDir);
            Console.WriteLine(" [*] Remote Repository: https://github.com/sudosanjam/Vault");
            Console.WriteLine(" [*] Checking for updates on branch 'main'...\n");

            // 1. Check if git is available
            string gitCheck = RunGitCommand(rootDir, "status --short");
            if (gitCheck == null)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine(" [ERROR] Git is not installed or not in PATH.");
                Console.WriteLine(" Please install Git for Windows to enable auto-patching.");
                Console.ResetColor();
                Console.WriteLine("\n Press any key to exit...");
                Console.ReadKey();
                return;
            }

            // 2. Fetch origin main
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine(" [*] Fetching remote release headers from GitHub...");
            Console.ResetColor();

            string fetchResult = RunGitCommand(rootDir, "fetch origin main");

            // 3. Compare revisions
            string behindCountStr = RunGitCommand(rootDir, "rev-list HEAD..origin/main --count");
            int behindCount = 0;
            if (!string.IsNullOrEmpty(behindCountStr))
            {
                int.TryParse(behindCountStr.Trim(), out behindCount);
            }

            if (behindCount > 0)
            {
                Console.ForegroundColor = ConsoleColor.Cyan;
                Console.WriteLine(string.Format("\n [!] Found {0} new patch(es) on GitHub!", behindCount));
                Console.WriteLine(" ------------------------------------------------------------------------");
                Console.ResetColor();

                string logCommits = RunGitCommand(rootDir, "log HEAD..origin/main --oneline -n 8");
                if (!string.IsNullOrEmpty(logCommits))
                {
                    Console.WriteLine(logCommits.Trim());
                }
                Console.WriteLine(" ------------------------------------------------------------------------\n");

                Console.Write(" Would you like to download and install this update now? (Y/N): ");
                string answer = Console.ReadLine();
                if (string.IsNullOrEmpty(answer) || !answer.Trim().ToUpper().StartsWith("Y"))
                {
                    Console.WriteLine("\n Update postponed. Exiting patcher.");
                    return;
                }

                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("\n [*] Pulling updates from GitHub...");
                Console.ResetColor();

                string pullResult = RunGitCommand(rootDir, "pull origin main");
                Console.WriteLine(pullResult);

                // Check if frontend rebuild is needed
                string distHtml = Path.Combine(rootDir, @"vault-app\frontend\dist\index.html");
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine(" [*] Ensuring frontend and dependencies are current...");
                Console.ResetColor();

                ProcessStartInfo npmPsi = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = "/c npm run build",
                    WorkingDirectory = Path.Combine(rootDir, @"vault-app\frontend"),
                    UseShellExecute = false
                };
                try
                {
                    using (Process proc = Process.Start(npmPsi))
                    {
                        proc.WaitForExit();
                    }
                }
                catch { }

                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("\n ========================================================================");
                Console.WriteLine(" [SUCCESS] Vault successfully updated to the latest version!");
                Console.WriteLine(" ========================================================================");
                Console.ResetColor();
            }
            else
            {
                string localCommit = RunGitCommand(rootDir, "rev-parse --short HEAD");
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("\n ========================================================================");
                Console.WriteLine(" [OK] Vault is already up-to-date!");
                Console.WriteLine(" Current Patch: " + (localCommit != null ? localCommit.Trim() : "latest"));
                Console.WriteLine(" No updates required.");
                Console.WriteLine(" ========================================================================");
                Console.ResetColor();
            }

            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.Write("\n Press [ENTER] to launch Vault now, or any other key to exit: ");
            Console.ResetColor();

            ConsoleKey key = ReadKeySafe();
            if (key == ConsoleKey.Enter)
            {
                string vaultExe = Path.Combine(rootDir, "vault.exe");
                if (File.Exists(vaultExe))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = vaultExe,
                        WorkingDirectory = rootDir,
                        UseShellExecute = true
                    });
                }
                else
                {
                    string setupExe = Path.Combine(rootDir, "setup.exe");
                    if (File.Exists(setupExe))
                    {
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = setupExe,
                            WorkingDirectory = rootDir,
                            UseShellExecute = true
                        });
                    }
                }
            }
        }

        static ConsoleKey ReadKeySafe()
        {
            try
            {
                return Console.ReadKey().Key;
            }
            catch
            {
                string line = Console.ReadLine();
                if (line != null && line.Length == 0) return ConsoleKey.Enter;
                return ConsoleKey.Escape;
            }
        }

        static string RunGitCommand(string workingDir, string arguments)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "git",
                    Arguments = arguments,
                    WorkingDirectory = workingDir,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using (Process proc = Process.Start(psi))
                {
                    string stdout = proc.StandardOutput.ReadToEnd();
                    string stderr = proc.StandardError.ReadToEnd();
                    proc.WaitForExit();
                    return string.IsNullOrEmpty(stdout) ? stderr : stdout;
                }
            }
            catch
            {
                return null;
            }
        }
    }
}
