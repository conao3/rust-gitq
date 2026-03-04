{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    treefmt-nix.url = "github:numtide/treefmt-nix";
    rust-overlay.url = "github:oxalica/rust-overlay";
  };

  outputs =
    inputs:
    inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "x86_64-linux"
        "aarch64-darwin"
      ];

      imports = [
        inputs.treefmt-nix.flakeModule
      ];

      perSystem =
        {
          system,
          ...
        }:
        let
          overlay = final: prev: {
            rustToolchain = prev.rust-bin.stable.latest.default;
          };
          pkgs = import inputs.nixpkgs {
            inherit system;
            overlays = [
              inputs.rust-overlay.overlays.default
              overlay
            ];
          };
        in
        {
          devShells.default = pkgs.mkShell {
            packages = with pkgs; [
              rustToolchain
            ];
          };

          treefmt = {
            projectRootFile = "flake.nix";
            programs.nixfmt.enable = true;
            programs.rustfmt.enable = true;
          };
        };
    };
}
