using System;
using System.Diagnostics;
using System.IO;

namespace Vault
{
    class SetupLauncher
    {
        static void Main(string[] args)
        {
            Console.Title = "Vault Setup & Environment Initializer";
            string rootDir = AppDomain.CurrentDomain.BaseDirectory;

            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine(@"  ========================================================================");
            Console.WriteLine(@"     ██╗   ██╗  █████╗  ██╗   ██╗ ██╗     ████████╗");
            Console.WriteLine(@"     ██║   ██║ ██╔══██╗ ██║   ██║ ██║     ╚══██╔══╝");
            Console.WriteLine(@"     ██║   ██║ ███████║ ██║   ██║ ██║        ██║   ");
            Console.WriteLine(@"     ╚██╗ ██╔╝ ██╔══██║ ██║   ██║ ██║        ██║   ");
            Console.WriteLine(@"      ╚████╔╝  ██║  ██║ ╚██████╔╝ ███████╗   ██║   ");
            Console.WriteLine(@"       ╚═══╝   ╚═╝  ╚═╝  ╚═════╝  ╚══════╝   ╚═╝   ");
            Console.WriteLine(@"        [ SETUP & ENVIRONMENT INITIALIZER - CLASSIC EDITION ]");
            Console.WriteLine(@"  ========================================================================");
            Console.ResetColor();

            Console.WriteLine("\n [*] Root directory: " + rootDir);
            Console.WriteLine(" [*] Initializing system checks, dependencies, and build pipelines...\n");

            string psScript = Path.Combine(rootDir, @"vault-app\scripts\setup.ps1");
            if (!File.Exists(psScript))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine(" [ERROR] Setup script missing: " + psScript);
                Console.ResetColor();
                Console.WriteLine("\n Press any key to exit...");
                Console.ReadKey();
                return;
            }

            // Run setup.ps1
            ProcessStartInfo psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = string.Format("-NoProfile -ExecutionPolicy Bypass -File \"{0}\"", psScript),
                WorkingDirectory = rootDir,
                UseShellExecute = false
            };

            int exitCode = -1;
            try
            {
                using (Process proc = Process.Start(psi))
                {
                    proc.WaitForExit();
                    exitCode = proc.ExitCode;
                }
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("\n [ERROR] Failed to execute setup: " + ex.Message);
                Console.ResetColor();
            }

            if (exitCode != 0)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("\n ========================================================================");
                Console.WriteLine(" [!] Vault setup failed or was interrupted (Exit Code: " + exitCode + ").");
                Console.WriteLine(" ========================================================================");
                Console.ResetColor();
                Console.WriteLine("\n Press any key to exit...");
                Console.ReadKey();
                return;
            }

            // Setup succeeded: Generate vault.exe for the user
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("\n [*] Generating game launcher executable (vault.exe)...");
            Console.ResetColor();

            bool launcherCreated = CompileVaultLauncher(rootDir);

            // Establish cross-links for notes and attachments
            EnsureAttachmentLinks(rootDir);

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("\n ========================================================================");
            Console.WriteLine(" [SUCCESS] Vault setup completed successfully!");
            if (launcherCreated)
            {
                Console.WriteLine(" [OK] Created launcher executable: vault.exe");
            }
            Console.WriteLine(" ========================================================================");
            Console.ResetColor();

            Console.WriteLine("\n You can now launch Vault at any time by double-clicking 'vault.exe'.");
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

        static bool CompileVaultLauncher(string rootDir)
        {
            string cscPath = @"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe";
            if (!File.Exists(cscPath))
            {
                cscPath = @"C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe";
            }

            string sourceFile = Path.Combine(rootDir, @"vault-app\launchers\VaultLauncher.cs");
            string targetExe = Path.Combine(rootDir, "vault.exe");
            string iconFile = Path.Combine(rootDir, "vault.ico");

            if (!File.Exists(sourceFile))
            {
                Console.WriteLine(" [WARN] VaultLauncher.cs not found, cannot build vault.exe.");
                return false;
            }

            string iconArg = File.Exists(iconFile) ? string.Format("/win32icon:\"{0}\"", iconFile) : "";
            string args = string.Format("/nologo /target:winexe {0} /out:\"{1}\" \"{2}\"", iconArg, targetExe, sourceFile);

            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = cscPath,
                    Arguments = args,
                    WorkingDirectory = rootDir,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                };

                using (Process proc = Process.Start(psi))
                {
                    proc.WaitForExit();
                    return proc.ExitCode == 0 && File.Exists(targetExe);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine(" [WARN] Compiler execution failed: " + ex.Message);
                return false;
            }
        }

        static void EnsureAttachmentLinks(string rootDir)
        {
            try
            {
                string nodesAtt = Path.Combine(rootDir, @"nodes\attachments");
                string targetAtt = Path.Combine(rootDir, @"attachments\images");
                if (Directory.Exists(targetAtt) && !Directory.Exists(nodesAtt))
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = "cmd.exe",
                        Arguments = string.Format("/c mklink /J \"{0}\" \"{1}\"", nodesAtt, targetAtt),
                        CreateNoWindow = true,
                        UseShellExecute = false
                    };
                    Process proc = Process.Start(psi);
                    if (proc != null) proc.WaitForExit();
                }
            }
            catch { }
        }
    }
}
