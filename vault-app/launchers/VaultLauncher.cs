using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

namespace Vault
{
    class VaultLauncher
    {
        static void Main(string[] args)
        {
            string rootDir = AppDomain.CurrentDomain.BaseDirectory;
            string pythonExe = Path.Combine(rootDir, @"vault-app\backend\venv\Scripts\python.exe");
            string pythonwExe = Path.Combine(rootDir, @"vault-app\backend\venv\Scripts\pythonw.exe");
            string distHtml = Path.Combine(rootDir, @"vault-app\frontend\dist\index.html");
            string trayScript = Path.Combine(rootDir, @"vault-app\scripts\tray_app.py");

            // 1. Verify environment setup
            if (!File.Exists(pythonExe) || !File.Exists(distHtml))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("================================================================");
                Console.WriteLine(" [ERROR] Vault setup has not been completed yet!");
                Console.WriteLine("================================================================");
                Console.ResetColor();
                Console.WriteLine("\n Vault requires initial setup before launching.");
                Console.WriteLine(" Missing virtual environment or frontend production assets.\n");
                Console.Write(" Would you like to run setup.exe now? (Y/N): ");

                string choice = Console.ReadLine();
                if (!string.IsNullOrEmpty(choice) && choice.Trim().ToUpper().StartsWith("Y"))
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
                    else
                    {
                        Console.WriteLine("\n[ERROR] setup.exe not found in " + rootDir);
                        Console.WriteLine("Press any key to exit...");
                        Console.ReadKey();
                    }
                }
                return;
            }

            // 2. Launch Vault via system tray / background server
            string runnerExe = File.Exists(pythonwExe) ? pythonwExe : pythonExe;
            string arguments = string.Format("\"{0}\"", trayScript);

            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = runnerExe,
                    Arguments = arguments,
                    WorkingDirectory = rootDir,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                Process.Start(psi);
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[ERROR] Failed to start Vault: " + ex.Message);
                Console.ResetColor();
                Console.WriteLine("Press any key to exit...");
                Console.ReadKey();
            }
        }
    }
}

