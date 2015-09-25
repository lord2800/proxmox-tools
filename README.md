# Proxmox Tools

Included:

* Puppet ENC script
 * Retrieves the node definition from the comments of the node itself. Requires PuppetDB, `vmid`, and `vmnode` facts.
* Puppet Autosign script
 * Checks the CSR for `pp_instance_id` (vm id) and `pp_product` (proxmox node) attributes and uses them to query the proxmox api to match the node name against the CSR.

Wishlist:

* Update a node definition from the command line
* Create a vm from the command line
